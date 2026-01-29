# Graph Visualization

A Next.js application for visualizing graph data using D3.js. Supports both [FalkorDB](https://www.falkordb.com/) (self-hosted graph database) and [Zep Cloud](https://help.getzep.com).

## Features

- Interactive graph visualization with force-directed layout
- **FalkorDB Mode**: Connect directly to your self-hosted FalkorDB instance
- **Zep Cloud Mode**: Connect to Zep Cloud for AI memory graph visualization
- Zoom and pan functionality
- Node and edge highlighting
- Node and edge inspection with detailed popovers
- Dark and light mode support
- Custom node colors based on entity types/labels
- Edge labeling

## Technology Stack

- [Next.js 15](https://nextjs.org/) with App Router
- [React 19](https://react.dev/)
- [D3.js](https://d3js.org/) for graph visualization
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Shadcn UI](https://ui.shadcn.com/) for UI components
- [FalkorDB](https://www.falkordb.com/) - Graph database client
- [Zep Cloud SDK](https://help.getzep.com/sdks/) (optional)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun installed
- A FalkorDB instance (local or remote) OR a Zep API key

### FalkorDB Setup (Recommended)

Start FalkorDB with Docker:

```bash
docker run -p 6380:6379 -p 3001:3000 \
  -e REDIS_ARGS="--requirepass InOpenSourceWeTrust!" \
  -e BROWSER=1 \
  falkordb/falkordb:latest
```

Or use docker-compose:

```yaml
services:
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6380:6379"   # FalkorDB port
      - "3001:3000"   # FalkorDB Browser UI
    environment:
      - REDIS_ARGS=--requirepass InOpenSourceWeTrust!
      - BROWSER=1
    volumes:
      - falkordb_data:/data

volumes:
  falkordb_data:
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/getzep/zep-graph-visualization.git
cd zep-graph-visualization
```

2. Install dependencies:

```bash
bun install
# or
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory:

```bash
# FalkorDB Connection Settings
FALKORDB_HOST=localhost
FALKORDB_PORT=6380
FALKORDB_PASSWORD=YOUR_PASSWORD

# Zep Cloud API Key (optional - only for Zep Cloud mode)
ZEP_API_KEY=your_zep_api_key
```

### Running the Development Server

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

The application provides two modes:

### FalkorDB Mode (Default)

1. Toggle the data source to "FalkorDB"
2. Select a graph from the dropdown (graphs are automatically loaded from your FalkorDB instance)
3. Click "View Graph" to visualize

### Zep Cloud Mode

1. Toggle the data source to "Zep Cloud"
2. Choose between User Mode or Group Mode
3. Enter the User ID or Group ID
4. Click "View Graph" to visualize

### Graph Interaction

- Click on nodes to see their details (name, labels, attributes, summary)
- Click on edges to see relationship information (type, fact, episodes)
- Zoom in/out using the mouse wheel
- Pan the graph by dragging
- Toggle between dark and light modes using the theme toggle

## API Endpoints

### FalkorDB Endpoints

- `GET /api/falkordb/graphs` - List all available graphs
- `GET /api/falkordb/[graphName]/triplets` - Get nodes and edges for a specific graph

### Zep Cloud Endpoints

- `GET /api/graph/user/[id]/triplets` - Get graph data for a user
- `GET /api/graph/group/[id]/triplets` - Get graph data for a group

## License

[MIT](LICENSE)
