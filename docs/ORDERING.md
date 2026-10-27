# Task ordering

TaskBoard uses consecutive integer positions 0 through n minus 1 within each column. Column position is separate from task position.

When a card moves, the server reads the target column ordered by position and then ID, excluding the moving card. It inserts the card at the requested final index, changes its column, renumbers the source column and renumbers the destination column. All updates happen inside one SQLite transaction: either every update succeeds, or none do. Oversized indices append; negative or noninteger positions are rejected. Same-column moves operate on the list after removing the moving card.

Quick-add appends at the end after normalizing that column. Deletion compacts the remaining positions in the same transaction. Changing the column in the task editor uses the same move function and appends to the target column before updating the fields, within one outer transaction. Existing equal positions are deterministically ordered by task ID and normalized only when the affected column is edited; there is no startup data rewrite.

The browser sends the intended insertion index. Dropping before a later card in the same column adjusts the index for the moving card's removal. The bottom drop zone appends. Dragging is disabled while search/filters are active, because visible indices would not describe the full column; the Move to select remains available. The server is the source of truth and the UI reloads board state after a successful response, without a page reload.

Tasks in the final ordered column may be created or moved into that column, but once there they cannot be edited or moved again; deletion remains allowed. This rule is enforced by both the UI and the server.

Column reorder sends every column ID exactly once. The server verifies ownership, checks the complete set, and assigns positions inside a transaction. Deleting a nonempty column is blocked. Concurrent moves are serialized by SQLite's synchronous write transactions; the last successful user action determines the resulting order. Live cross-client updates are outside this MVP.

Tests cover append, moving both directions within a column, cross-column moves, editor moves, deletion compaction, invalid destination rejection, and order after browser reload.
