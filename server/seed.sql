-- Demo data only. Run through npm run seed, which refuses existing database files.
BEGIN TRANSACTION;
INSERT INTO users (id,name,email,password_hash) VALUES
(1,'Demo Owner','owner@taskboard.example','$2b$10$vjotN9wL0cgwTtiaWIgS7OR7Mx2bj3x/NYh3Xhn4L68FwEHkjW.pq'),
(2,'Demo Member','member@taskboard.example','$2b$10$vjotN9wL0cgwTtiaWIgS7OR7Mx2bj3x/NYh3Xhn4L68FwEHkjW.pq');
INSERT INTO boards (id,name,description,owner_id) VALUES (1,'College Project','TaskBoard submission demo',1);
INSERT INTO board_members (board_id,user_id,role) VALUES (1,1,'owner'),(1,2,'member');
INSERT INTO columns (id,board_id,name,position) VALUES (1,1,'To Do',0),(2,1,'In Progress',1),(3,1,'Done',2);
INSERT INTO tasks (board_id,column_id,title,description,priority,due_date,assignee_id,created_by,position) VALUES
(1,1,'Review requirements','Check all P1 features','High','2026-10-25',1,1,0),
(1,1,'Prepare viva notes','Explain data relationships','Medium',NULL,2,1,1),
(1,1,'Capture screenshots','Document login and board','Low',NULL,NULL,1,2),
(1,2,'Test authentication','Registration, login and expired JWT','High',NULL,1,1,0),
(1,2,'Verify task ordering','Move cards and reload','High',NULL,2,1,1),
(1,2,'Complete README','Setup and API examples','Medium',NULL,1,1,2),
(1,3,'Design database','Six related SQLite tables','Low','2026-10-24',1,1,0),
(1,3,'Create task cards','Priority, due date and assignee','Medium',NULL,2,1,1);
INSERT INTO comments (task_id,user_id,content) VALUES (4,2,'Check invalid passwords and expired sessions too.');
COMMIT;
