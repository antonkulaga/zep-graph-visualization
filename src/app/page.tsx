import { GraphClient } from "./GraphClient";

export default async function Home() {
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-4">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Graph Visualization
        </h2>
      </div>

      <div className="flex-1 min-h-0">
        <GraphClient />
      </div>
    </div>
  );
}
