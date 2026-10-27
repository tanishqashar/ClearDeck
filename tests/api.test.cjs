const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskboard-test-'));
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.JWT_SECRET = 'temporary-test-secret-not-for-production';
let server, base, owner, member, outsider, boardId, columns, taskId;
async function request(route, method = 'GET', body, token) {
    const r = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
}
before(async () => {
    const app = require('../server/server');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); require('../server/db').close(); fs.rmSync(dir, { recursive: true }); });
test('registration, bcrypt, duplicate email, login, invalid input and expired JWT', async () => {
    for (const name of ['owner', 'member', 'outsider']) {
        assert.equal((await request('/auth/register', 'POST', { name, email: `${name}@example.test`, password: 'Password123!' })).status, 201);
    }
    assert.equal((await request('/auth/register', 'POST', { name: 'Again', email: 'OWNER@example.test', password: 'Password123!' })).status, 409);
    assert.equal((await request('/auth/register', 'POST', { name: {}, email: 'bad', password: 'short' })).status, 400);
    assert.equal((await request('/auth/login', 'POST', { email: 'owner@example.test', password: 'wrong' })).status, 401);
    owner = (await request('/auth/login', 'POST', { email: 'OWNER@example.test', password: 'Password123!' })).data;
    member = (await request('/auth/login', 'POST', { email: 'member@example.test', password: 'Password123!' })).data;
    outsider = (await request('/auth/login', 'POST', { email: 'outsider@example.test', password: 'Password123!' })).data;
    assert.ok(owner.token);
    const row = require('../server/db').prepare('SELECT password_hash FROM users WHERE id = ?').get(owner.user.id);
    assert.ok(await require('bcrypt').compare('Password123!', row.password_hash));
    assert.equal((await request('/boards')).status, 401);
    const expired = require('jsonwebtoken').sign({ id: owner.user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await request('/boards', 'GET', undefined, expired)).status, 401);
});
test('board creation, permissions, membership and task editing persists all API fields', async () => {
    const created = await request('/boards', 'POST', { name: 'Test board', description: 'Preserved' }, owner.token);
    assert.equal(created.status, 201); boardId = created.data.boardId;
    const board = await request(`/boards/${boardId}`, 'GET', undefined, owner.token);
    columns = board.data.columns; assert.equal(columns.length, 3);
    assert.equal((await request(`/boards/${boardId}`, 'GET', undefined, outsider.token)).status, 404);
    assert.equal((await request(`/boards/${boardId}/members`, 'POST', { email: 'member@example.test' }, owner.token)).status, 201);
    const createdFields = {
        title: 'Initial',
        description: 'Created with every field',
        priority: 'High',
        due_date: '2026-12-01',
        assignee_id: member.user.id,
        column_id: columns[0].id
    };
    const task = await request(`/boards/${boardId}/tasks`, 'POST', createdFields, owner.token);
    assert.equal(task.status, 201); taskId = task.data.taskId;
    assert.equal((await request(`/boards/${boardId}/tasks`, 'POST', {
        title: 'Past due',
        due_date: '2020-01-01',
        column_id: columns[0].id
    }, owner.token)).status, 400);
    const doneTask = await request(`/boards/${boardId}/tasks`, 'POST', {
        title: 'Finished task',
        column_id: columns[2].id
    }, owner.token);
    assert.equal(doneTask.status, 201);
    assert.equal((await request(`/boards/${boardId}/tasks/${doneTask.data.taskId}`, 'PUT', {
        title: 'Should not edit',
        column_id: columns[2].id
    }, owner.token)).status, 400);
    assert.equal((await request(`/boards/${boardId}/tasks/${doneTask.data.taskId}/move`, 'PUT', {
        column_id: columns[0].id,
        position: 0
    }, owner.token)).status, 400);
    assert.equal((await request(`/boards/${boardId}/tasks/${doneTask.data.taskId}`, 'DELETE', undefined, owner.token)).status, 200);
    const persistedCreation = (await request(`/boards/${boardId}`, 'GET', undefined, owner.token)).data.tasks.find(t => t.id === taskId);
    for (const [k,v] of Object.entries(createdFields)) assert.equal(persistedCreation[k], v, k);
    const updated = { title: 'Edited', description: 'Updated description', priority: 'High', due_date: '2026-11-15', assignee_id: member.user.id, column_id: columns[1].id };
    assert.equal((await request(`/boards/${boardId}/tasks/${taskId}`, 'PUT', updated, member.token)).status, 200);
    const saved = (await request(`/boards/${boardId}`, 'GET', undefined, owner.token)).data.tasks.find(t => t.id === taskId);
    for (const [k,v] of Object.entries(updated)) assert.equal(saved[k], v, k);
    assert.equal((await request(`/boards/${boardId}`, 'DELETE', undefined, member.token)).status, 404);
});
test('integer ordering: append, cross-column move, same-column reorder, edit move, deletion and rollback', async () => {
    const db = require('../server/db');
    const ids = [];
    for (const title of ['A','B','C','D']) {
        const r = await request(`/boards/${boardId}/tasks`, 'POST', { title, column_id: columns[0].id }, owner.token);
        assert.equal(r.status, 201); ids.push(r.data.taskId);
    }
    const rows = col => db.prepare('SELECT id, position FROM tasks WHERE column_id = ? ORDER BY position, id').all(col);
    const contiguous = col => assert.deepEqual(rows(col).map(t => t.position), rows(col).map((_,i) => i));
    assert.deepEqual(rows(columns[0].id).map(t => t.id), ids);
    // Move B to the end, then D to index zero within the same column.
    assert.equal((await request(`/boards/${boardId}/tasks/${ids[1]}/move`, 'PUT', { column_id: columns[0].id, position: 3 }, member.token)).status, 200);
    assert.deepEqual(rows(columns[0].id).map(t => t.id), [ids[0],ids[2],ids[3],ids[1]]);
    await request(`/boards/${boardId}/tasks/${ids[3]}/move`, 'PUT', { column_id: columns[0].id, position: 0 }, owner.token);
    assert.deepEqual(rows(columns[0].id).map(t => t.id), [ids[3],ids[0],ids[2],ids[1]]);
    await request(`/boards/${boardId}/tasks/${ids[0]}/move`, 'PUT', { column_id: columns[1].id, position: 0 }, owner.token);
    contiguous(columns[0].id); contiguous(columns[1].id);
    assert.equal(rows(columns[1].id)[0].id, ids[0]);
    const beforeRows = rows(columns[1].id);
    assert.equal((await request(`/boards/${boardId}/tasks/${ids[0]}/move`, 'PUT', { column_id: 999999, position: 0 }, owner.token)).status, 400);
    assert.deepEqual(rows(columns[1].id), beforeRows);
    assert.equal((await request(`/boards/${boardId}/tasks/${ids[2]}`, 'PUT', { title: 'Edit move', column_id: columns[2].id }, owner.token)).status, 200);
    contiguous(columns[0].id); contiguous(columns[2].id);
    await request(`/boards/${boardId}/tasks/${ids[3]}`, 'DELETE', undefined, owner.token);
    contiguous(columns[0].id);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
});
test('comments, search/filter, column CRUD/reorder, permission boundaries and member removal', async () => {
    const root = `/boards/${boardId}`;
    const comment = await request(`${root}/tasks/${taskId}/comments`, 'POST', { content: 'Member comment' }, member.token);
    assert.equal(comment.status, 201);
    const cid = comment.data.commentId;
    const persistedComments = await request(`${root}/tasks/${taskId}/comments`, 'GET', undefined, owner.token);
    assert.equal(persistedComments.status, 200);
    assert.equal(persistedComments.data.some(c => c.id === cid && c.content === 'Member comment'), true);
    assert.equal((await request(`${root}/tasks/${taskId}/comments/${cid}`, 'DELETE', undefined, owner.token)).status, 200);
    const ownerComment = await request(`${root}/tasks/${taskId}/comments`, 'POST', { content: 'Owner comment' }, owner.token);
    assert.equal(ownerComment.status, 201);
    const ownerCommentId = ownerComment.data.commentId;
    assert.equal((await request(`${root}/tasks/${taskId}/comments/${ownerCommentId}`, 'DELETE', undefined, member.token)).status, 404);
    const memberComment = await request(`${root}/tasks/${taskId}/comments`, 'POST', { content: 'Member comment to delete' }, member.token);
    assert.equal(memberComment.status, 201);
    const memberCommentId = memberComment.data.commentId;
    assert.equal((await request(`${root}/tasks/${taskId}/comments/${memberCommentId}`, 'DELETE', undefined, outsider.token)).status, 404);
    assert.equal((await request(`${root}/tasks/${taskId}/comments/${memberCommentId}`, 'DELETE', undefined, member.token)).status, 200);
    assert.equal((await request(`${root}/tasks/${taskId}/comments/999999`, 'DELETE', undefined, owner.token)).status, 404);
    const comments = await request(`${root}/tasks/${taskId}/comments`, 'GET', undefined, owner.token);
    assert.equal(comments.data[0].user_name, 'owner'); assert.ok(comments.data[0].created_at);
    assert.equal((await request(`${root}/tasks/search?q=Updated%20description`, 'GET', undefined, member.token)).data.length, 1);
    assert.equal((await request(`${root}/tasks/filter?priority=High&mine=true`, 'GET', undefined, member.token)).data[0].id, taskId);
    assert.equal((await request(`${root}/tasks`, 'POST', { title: 'Invalid assignee', column_id: columns[0].id, assignee_id: outsider.user.id }, owner.token)).status, 400);
    assert.equal((await request(`${root}/tasks`, 'POST', { title: 'Invalid date', column_id: columns[0].id, due_date: '2026-02-30' }, owner.token)).status, 400);
    assert.equal((await request(`${root}/columns`, 'POST', { name: 'Denied' }, member.token)).status, 404);
    const added = await request(`${root}/columns`, 'POST', { name: 'Review' }, owner.token);
    assert.equal(added.status, 201);
    assert.equal((await request(`${root}/columns/${added.data.columnId}`, 'PUT', { name: 'QA' }, owner.token)).status, 200);
    const ids = [...columns.map(c => c.id), added.data.columnId].reverse();
    assert.equal((await request(`${root}/columns/reorder`, 'PUT', { columnIds: ids }, owner.token)).status, 200);
    assert.deepEqual((await request(root, 'GET', undefined, owner.token)).data.columns.map(c => c.id), ids);
    assert.equal((await request(`${root}/columns/reorder`, 'PUT', { columnIds: [ids[0],ids[0]] }, owner.token)).status, 400);
    assert.equal((await request(`${root}/columns/${columns[1].id}`, 'DELETE', undefined, owner.token)).status, 400);
    assert.equal((await request(`${root}/columns/${added.data.columnId}`, 'DELETE', undefined, owner.token)).status, 200);
    for (const [route,method,body] of [[root,'GET'],[`${root}/tasks`,'POST',{title:'No',column_id:columns[0].id}],[`${root}/members`,'GET'],[`${root}/tasks/${taskId}/comments`,'GET'],[`${root}/tasks/${taskId}`,'DELETE'],[`${root}/tasks/${taskId}/move`,'PUT',{column_id:columns[0].id,position:0}],[`${root}/tasks/search?q=x`,'GET'],[`${root}/tasks/filter?priority=High`,'GET']]) {
        assert.equal((await request(route, method, body, outsider.token)).status, 404, route);
    }
    assert.equal((await request(`${root}/members/${owner.user.id}`, 'DELETE', undefined, owner.token)).status, 400);
    assert.equal((await request(`${root}/members/${member.user.id}`, 'DELETE', undefined, owner.token)).status, 200);
    assert.equal((await request(root, 'GET', undefined, member.token)).status, 404);
    assert.equal(require('../server/db').prepare('SELECT assignee_id FROM tasks WHERE id = ?').get(taskId).assignee_id, null);
});
test('100-task board API timing, JSON validation and cascading delete', async () => {
    const db = require('../server/db');
    const insert = db.prepare('INSERT INTO tasks (board_id,column_id,title,created_by,position) VALUES (?,?,?,?,?)');
    db.transaction(() => { for (let i=0;i<100;i++) insert.run(boardId, columns[0].id, `Load task ${i}`, owner.user.id, i+10); })();
    const start = performance.now();
    const result = await request(`/boards/${boardId}`, 'GET', undefined, owner.token);
    const elapsed = performance.now()-start;
    assert.ok(result.data.tasks.length >= 100); assert.ok(elapsed < 2000, `API took ${elapsed}ms`);
    console.log(`100-task board API: ${elapsed.toFixed(1)}ms (not browser render timing)`);
    assert.equal((await request('/boards', 'POST', { name: { bad: true } }, owner.token)).status, 400);
    const invalid = await fetch(base+'/boards', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${owner.token}`}, body:'{' });
    assert.equal(invalid.status,400); assert.ok((await invalid.json()).error);
    assert.equal((await request(`/boards/${boardId}`, 'PUT', { name:'Renamed',description:'Changed' }, owner.token)).status,200);
    assert.equal((await request(`/boards/${boardId}`, 'DELETE', undefined, owner.token)).status,200);
    for (const table of ['boards','board_members','columns','tasks','comments']) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
});
test('assignment resource URLs reuse membership checks and persisted behavior', async () => {
    const r = await request('/boards','POST',{name:'Resource routes'},owner.token);
    const id=r.data.boardId;
    const cols=(await request(`/boards/${id}`,'GET',undefined,owner.token)).data.columns;
    let t=await request(`/columns/${cols[0].id}/tasks`,'POST',{title:'Resource card',description:'Find me'},owner.token);
    assert.equal(t.status,201); const tid=t.data.taskId;
    assert.equal((await request(`/tasks/${tid}`,'GET',undefined,outsider.token)).status,404);
    assert.equal((await request(`/tasks/${tid}`,'PUT',{title:'Changed resource',column_id:cols[0].id,priority:'High'},owner.token)).status,200);
    assert.equal((await request(`/tasks/${tid}/move`,'PATCH',{columnId:cols[1].id,position:0},owner.token)).status,200);
    assert.equal((await request(`/tasks/${tid}`,'GET',undefined,owner.token)).data.column_id,cols[1].id);
    const c=await request(`/tasks/${tid}/comments`,'POST',{content:'Resource comment'},owner.token);
    assert.equal(c.status,201);
    assert.equal((await request(`/comments/${c.data.commentId}`,'DELETE',undefined,outsider.token)).status,404);
    assert.equal((await request(`/comments/${c.data.commentId}`,'DELETE',undefined,owner.token)).status,200);
    assert.equal((await request(`/boards/${id}/tasks?q=Changed&priority=High`,'GET',undefined,owner.token)).data[0].id,tid);
    assert.equal((await request(`/columns/${cols[0].id}`,'PUT',{name:'Custom'},owner.token)).status,200);
    assert.equal((await request(`/columns/${cols[0].id}`,'PUT',{position:2},owner.token)).status,200);
    assert.equal((await request(`/columns/${cols[0].id}`,'DELETE',undefined,owner.token)).status,200);
    assert.equal((await request(`/tasks/${tid}`,'DELETE',undefined,owner.token)).status,200);
    await request(`/boards/${id}`,'DELETE',undefined,owner.token);
});
test('seed creates exactly the demo dataset and refuses to overwrite an existing database', () => {
    const {spawnSync}=require('node:child_process');
    const demo=path.join(dir,'demo.db');
    const run=()=>spawnSync(process.execPath,[path.resolve(__dirname,'../server/seed.js')],{env:{...process.env,DB_PATH:demo},encoding:'utf8'});
    assert.equal(run().status,0);
    const Database=require('better-sqlite3');const db=new Database(demo,{readonly:true});
    for(const [table,n] of [['users',2],['boards',1],['columns',3],['tasks',8]]) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,n);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);db.close();
    const before=fs.readFileSync(demo);assert.equal(run().status,1);assert.deepEqual(fs.readFileSync(demo),before);
});
