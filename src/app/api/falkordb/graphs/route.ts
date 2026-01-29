import { NextResponse } from "next/server";
import { createClient } from "redis";

export async function GET() {
  const host = process.env.FALKORDB_HOST || "localhost";
  const port = parseInt(process.env.FALKORDB_PORT || "6380", 10);
  const password = process.env.FALKORDB_PASSWORD || "InOpenSourceWeTrust!";

  const client = createClient({
    socket: { host, port },
    password,
  });

  try {
    await client.connect();

    // FalkorDB stores graph keys, we can list them with GRAPH.LIST
    const graphs = await client.sendCommand(["GRAPH.LIST"]) as string[];

    return NextResponse.json({ graphs: graphs || [] });
  } catch (error) {
    console.error("Error connecting to FalkorDB:", error);
    return NextResponse.json(
      { error: "Failed to connect to FalkorDB", details: String(error) },
      { status: 500 }
    );
  } finally {
    await client.disconnect();
  }
}
