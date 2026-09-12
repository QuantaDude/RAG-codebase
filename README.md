# RAG-codebase

A RAG (retrieval-augmented generation) system for searching a codebase in natural language. A query is parsed for structural constraints (kind, parameters, return type) by a local decoder LLM, embedded semantically by a local code-embedding model, and matched against indexed code chunks with pgvector cosine similarity.

The project is a pnpm monorepo:

- **`apps/api`** — Express + Drizzle ORM + PostgreSQL/pgvector backend. Runs the local LLMs via `node-llama-cpp` and parses source with `tree-sitter`.
- **`apps/web`** — React + Vite chat UI for sending queries to the API.

> Once the project is at an acceptable stage, the plan is to drop the Express dependency in favor of custom HTTP helpers.

## Roadmap

| Iteration | What it covers | Status |
|---|---|---|
| 1st | Search through existing embedded/indexed code via the UI: query → query endpoint → structural meaning via a decoder transformer + semantic meaning via a code-embedding model → narrow down chunks → pgvector cosine similarity search → return the code body with the highest similarity score. | In progress |
| 2nd | Guest user + zip project upload, showing chunk-embedding progress to the user. | ⬜ Not started |
| 3rd | User accounts. | ⬜ Not started — schema and route stubs exist, no working register/login logic yet |
| 4th | Add the option to share a chat with guest viewers. | ⬜ Not started |
| 5th | Git support, incremental embedding/indexing. | ⬜ Not started |
| 6th | Infer if the query asked for an explaination, try to explain the piece of code using qwen. | ⬜ Not started |
| 7th (maybe) | Change the monolithic pipeline to distributed queue workers — each worker does chunking + encoding, or querying. | ⬜ Not started |
| 8th (optional) | Add the option to remove a GitHub repo's code from the database. | ⬜ Not started |

## Prerequisites

- Node.js (LTS, 20+ recommended)
- [pnpm](https://pnpm.io/)
- A local PostgreSQL server with the [pgvector](https://github.com/pgvector/pgvector) extension available, and the `createdb`/`psql` CLI tools on your `PATH`
- A few GB of free disk space for the local GGUF models pulled in the setup step below

## Getting it running locally

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/QuantaDude/RAG-codebase.git
   cd RAG-codebase
   pnpm install
   ```

2. **Configure the API's environment**
   Create `apps/api/.env.development` with your local Postgres connection details:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=<your_pg_user>
   DB_PASSWORD=<your_pg_password>
   DB_NAME=rag_codebase
   ```
   For a release-style run, create `apps/api/.env` instead — it's the file read whenever a script sets `BUILD=release`.

3. **Create the database and enable pgvector**
   ```bash
   cd apps/api
   pnpm dev:setup:db
   ```
   This shells out to your local `createdb` and `psql` binaries (using `DB_NAME` from the env file above, and otherwise your normal local Postgres connection defaults) to create the database and run `CREATE EXTENSION IF NOT EXISTS vector;`.

4. **Run the database migrations**
   ```bash
   pnpm dev:db:migrate
   ```
   `pnpm dev:db:push` is also available if you'd rather push the schema directly instead of running the migrations.

5. **Download the local models**
   ```bash
   pnpm setup:models
   ```
   Downloads the decoder model `Qwen3-4B-Instruct-2507`, used for structural query parsing and the code-embedding model `jina-code-embeddings-0.5b` as GGUF files into `apps/api/models/`.

6. **Seed sample data**
   ```bash
   pnpm dev:db:seed
   ```
   There's no upload/ingestion UI yet (see the 2nd iteration above), so this is currently the only way to get searchable data into the database — it inserts a handful of sample functions and embeds them.

7. **Start the API**
   ```bash
   pnpm dev
   ```
   Starts the Express server on `http://localhost:3000`.

8. **Start the web app**, in a separate terminal:
   ```bash
   cd apps/web
   pnpm dev
   ```
   Starts the Vite dev server, normally on `http://localhost:5173`. 

9. **Open the app**
   Visit `http://localhost:5173` and query the seeded sample functions from the chat box.

Once steps 2–6 have been done at least once, you can also run `pnpm dev` from the repo root to start both apps' dev servers in parallel.

