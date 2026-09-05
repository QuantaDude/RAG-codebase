# RAG-codebase

Once the project is at an acceptable stage, I aim to remove express.js dependency by implementing my own HTTP helpers.

1st Iteration:
Search through existing embedded and indexed code through UI 
query -> query endpoint -> get structural meaning through decoder transformer + semantic meaning through sbert -> narrow down chunks ->pg vector cosine similarity search -> return the code body with most similar score.

2nd Iteration:
Guest user + zip project upload, show chunks embedding progress to user.

3rd Iteration:
User accounts

4th:
Add the option to share chat with guest viewers

5th:
git support, Incremental embedding/indexing.

6th (Maybe):
change the monolithic pipeline to distributed queue workers. Each worker does chunking and encoding or querying.

7th (Optional):
Add option to remove github repo code from database.

