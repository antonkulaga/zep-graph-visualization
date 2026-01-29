import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";
import { Node, Edge } from "@/lib/types/graph";
import { createTriplets } from "@/lib/utils/graph";

interface FalkorNode {
  id: number;
  labels: string[];
  properties: Record<string, unknown>;
}

interface FalkorEdge {
  id: number;
  relation: string;
  sourceId: number;
  destId: number;
  properties: Record<string, unknown>;
}

function parseProperties(propsArray: unknown[][]): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const prop of propsArray) {
    if (Array.isArray(prop) && prop.length >= 2) {
      const [key, value] = prop;
      props[String(key)] = value;
    }
  }
  return props;
}

function parseNodeFromResponse(item: unknown[]): FalkorNode | null {
  // FalkorDB node format: [[key, value], [key, value], ...]
  // Keys: "id", "labels", "properties"
  const nodeData: Record<string, unknown> = {};
  
  for (const entry of item) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [key, value] = entry;
      nodeData[String(key)] = value;
    }
  }
  
  if (nodeData.id === undefined) return null;
  
  const properties = Array.isArray(nodeData.properties) 
    ? parseProperties(nodeData.properties as unknown[][])
    : {};
  
  return {
    id: Number(nodeData.id),
    labels: Array.isArray(nodeData.labels) ? nodeData.labels as string[] : [],
    properties,
  };
}

function parseEdgeFromResponse(item: unknown[]): FalkorEdge | null {
  // FalkorDB edge format: [[key, value], [key, value], ...]
  // Keys: "id", "type", "src_node", "dest_node", "properties"
  const edgeData: Record<string, unknown> = {};
  
  for (const entry of item) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [key, value] = entry;
      edgeData[String(key)] = value;
    }
  }
  
  if (edgeData.id === undefined) return null;
  
  const properties = Array.isArray(edgeData.properties) 
    ? parseProperties(edgeData.properties as unknown[][])
    : {};
  
  return {
    id: Number(edgeData.id),
    relation: String(edgeData.type || "RELATES_TO"),
    sourceId: Number(edgeData.src_node),
    destId: Number(edgeData.dest_node),
    properties,
  };
}

function isNodeData(item: unknown[]): boolean {
  if (!Array.isArray(item)) return false;
  const keys = item.map(entry => Array.isArray(entry) ? String(entry[0]) : "");
  return keys.includes("labels") && !keys.includes("type");
}

function isEdgeData(item: unknown[]): boolean {
  if (!Array.isArray(item)) return false;
  const keys = item.map(entry => Array.isArray(entry) ? String(entry[0]) : "");
  return keys.includes("type") && keys.includes("src_node");
}

function parseGraphResult(result: unknown): { nodes: FalkorNode[]; edges: FalkorEdge[] } {
  const nodeMap = new Map<number, FalkorNode>();
  const edgeMap = new Map<number, FalkorEdge>();

  if (!Array.isArray(result) || result.length < 2) {
    return { nodes: [], edges: [] };
  }

  const data = result[1] as unknown[][];

  if (!Array.isArray(data)) {
    return { nodes: [], edges: [] };
  }

  for (const row of data) {
    if (!Array.isArray(row)) continue;
    
    for (const item of row) {
      if (!Array.isArray(item)) continue;
      
      if (isNodeData(item as unknown[])) {
        const node = parseNodeFromResponse(item as unknown[]);
        if (node && !nodeMap.has(node.id)) {
          nodeMap.set(node.id, node);
        }
      } else if (isEdgeData(item as unknown[])) {
        const edge = parseEdgeFromResponse(item as unknown[]);
        if (edge && !edgeMap.has(edge.id)) {
          edgeMap.set(edge.id, edge);
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function transformFalkorNode(node: FalkorNode): Node {
  const props = node.properties || {};
  return {
    uuid: String(props.uuid || node.id),
    name: String(props.name || `Node_${node.id}`),
    summary: props.summary ? String(props.summary) : undefined,
    labels: node.labels,
    attributes: props,
    created_at: props.created_at ? String(props.created_at) : new Date().toISOString(),
    updated_at: props.updated_at ? String(props.updated_at) : new Date().toISOString(),
  };
}

function transformFalkorEdge(edge: FalkorEdge, nodeIdToUuid: Map<number, string>): Edge {
  const props = edge.properties || {};
  return {
    uuid: String(props.uuid || edge.id),
    source_node_uuid: nodeIdToUuid.get(edge.sourceId) || String(edge.sourceId),
    target_node_uuid: nodeIdToUuid.get(edge.destId) || String(edge.destId),
    type: edge.relation,
    name: props.name ? String(props.name) : edge.relation,
    fact: props.fact ? String(props.fact) : undefined,
    episodes: props.episodes
      ? Array.isArray(props.episodes)
        ? props.episodes.map(String)
        : [String(props.episodes)]
      : undefined,
    created_at: props.created_at ? String(props.created_at) : new Date().toISOString(),
    updated_at: props.updated_at ? String(props.updated_at) : new Date().toISOString(),
    valid_at: props.valid_at ? String(props.valid_at) : undefined,
    expired_at: props.expired_at ? String(props.expired_at) : undefined,
    invalid_at: props.invalid_at ? String(props.invalid_at) : undefined,
  };
}

// Default query for fetching graph data
const DEFAULT_QUERY = "MATCH (n) OPTIONAL MATCH (n)-[e]-(m) RETURN * LIMIT 100";

async function executeQuery(
  graphName: string,
  query: string
): Promise<NextResponse> {
  const host = process.env.FALKORDB_HOST || "localhost";
  const port = parseInt(process.env.FALKORDB_PORT || "6380", 10);
  const password = process.env.FALKORDB_PASSWORD || "InOpenSourceWeTrust!";

  const client = createClient({
    socket: { host, port },
    password,
  });

  try {
    if (!graphName) {
      return NextResponse.json({ error: "Graph name is required" }, { status: 400 });
    }

    await client.connect();

    console.log(`Executing Cypher query on ${graphName}: ${query}`);
    const result = await client.sendCommand(["GRAPH.QUERY", graphName, query]);

    const { nodes: falkorNodes, edges: falkorEdges } = parseGraphResult(result);

    // Build node ID to UUID mapping
    const nodeIdToUuid = new Map<number, string>();
    for (const node of falkorNodes) {
      const uuid = String(node.properties.uuid || node.id);
      nodeIdToUuid.set(node.id, uuid);
    }

    // Transform to our types
    const nodes = falkorNodes.map(transformFalkorNode);
    const edges = falkorEdges.map(edge => transformFalkorEdge(edge, nodeIdToUuid));

    console.log(`Parsed ${nodes.length} nodes and ${edges.length} edges from ${graphName}`);

    if (!nodes.length && !edges.length) {
      return NextResponse.json({ triplets: [], query });
    }

    // Combine nodes and edges into triplets
    const triplets = createTriplets(edges, nodes);

    return NextResponse.json({ triplets, query });
  } catch (error) {
    console.error("Error fetching graph data from FalkorDB:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph data", details: String(error), query },
      { status: 500 }
    );
  } finally {
    await client.disconnect();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ graphName: string }> }
) {
  const { graphName } = await params;
  
  // Check for query parameter in URL
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") || DEFAULT_QUERY;
  
  return executeQuery(graphName, query);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ graphName: string }> }
) {
  const { graphName } = await params;
  
  // Get query from request body
  const body = await request.json();
  const query = body.query || DEFAULT_QUERY;
  
  return executeQuery(graphName, query);
}
