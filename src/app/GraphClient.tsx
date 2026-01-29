"use client";

import { useState, ChangeEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { GraphVisualization } from "@/components/graph/GraphVisualization";
import { GraphRef } from "@/components/graph/Graph";
import { RawTriplet } from "@/lib/types/graph";

const DEFAULT_CYPHER_QUERY = "MATCH (n) OPTIONAL MATCH (n)-[e]-(m) RETURN * LIMIT 100";

interface UserDetailsProps {
  userID?: string;
}

export function GraphClient({ userID: initialUserID }: UserDetailsProps) {
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [triplets, setTriplets] = useState<RawTriplet[]>([]);
  const graphRef = useRef<GraphRef>(null);

  // Mode: "zep" for Zep Cloud, "falkordb" for direct FalkorDB
  const [mode, setMode] = useState<"zep" | "falkordb">("falkordb");

  // Zep mode state
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [entityId, setEntityId] = useState(initialUserID || "");

  // FalkorDB mode state
  const [availableGraphs, setAvailableGraphs] = useState<string[]>([]);
  const [selectedGraph, setSelectedGraph] = useState("");
  const [isLoadingGraphs, setIsLoadingGraphs] = useState(false);
  const [cypherQuery, setCypherQuery] = useState(DEFAULT_CYPHER_QUERY);
  const [currentGraphName, setCurrentGraphName] = useState("");

  // Load available graphs when in FalkorDB mode
  const loadAvailableGraphs = async () => {
    setIsLoadingGraphs(true);
    try {
      const response = await fetch("/api/falkordb/graphs");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load graphs");
      }
      const data = await response.json();
      setAvailableGraphs(data.graphs || []);
      // Don't auto-select - let user choose explicitly
    } catch (error) {
      console.error("Error loading graphs:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load graphs"
      );
    } finally {
      setIsLoadingGraphs(false);
    }
  };

  useEffect(() => {
    if (mode === "falkordb") {
      loadAvailableGraphs();
    }
  }, [mode]);

  // No auto-load - user must explicitly run the query

  // Load FalkorDB graph with custom query
  const handleLoadFalkorDBGraph = async (graphName: string, query?: string) => {
    if (!graphName) return;
    
    const queryToUse = query || cypherQuery;
    setIsLoadingGraph(true);
    try {
      const response = await fetch(
        `/api/falkordb/${encodeURIComponent(graphName)}/triplets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: queryToUse }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load graph");
      }

      const data = await response.json();
      setTriplets(data.triplets);
      setCurrentGraphName(graphName);
    } catch (error) {
      console.error("Error loading graph:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load graph"
      );
    } finally {
      setIsLoadingGraph(false);
    }
  };

  // Run the current Cypher query
  const handleRunQuery = () => {
    if (selectedGraph) {
      handleLoadFalkorDBGraph(selectedGraph, cypherQuery);
    } else {
      toast.error("Please select a graph first");
    }
  };

  const handleLoadGraph = async () => {
    if (mode === "zep") {
      if (!entityId.trim()) {
        toast.error("Please enter an ID");
        return;
      }

      setIsLoadingGraph(true);
      try {
        const endpointType = isGroupMode ? "group" : "user";
        const response = await fetch(
          `/api/graph/${endpointType}/${encodeURIComponent(entityId)}/triplets`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to load graph");
        }

        const data = await response.json();
        setTriplets(data.triplets);
        setCurrentGraphName(`${isGroupMode ? "Group" : "User"}: ${entityId}`);
      } catch (error) {
        console.error("Error loading graph:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to load graph"
        );
      } finally {
        setIsLoadingGraph(false);
      }
    } else {
      handleRunQuery();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Controls - Always visible at top */}
      <div className="flex-shrink-0 space-y-4 p-4 bg-background border rounded-lg">
        {/* Mode Toggle */}
        <div className="flex items-center space-x-4 pb-4 border-b">
          <Label className="font-semibold">Data Source:</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="mode-toggle"
              checked={mode === "falkordb"}
              onCheckedChange={(checked) =>
                setMode(checked ? "falkordb" : "zep")
              }
            />
            <Label htmlFor="mode-toggle">
              {mode === "falkordb" ? "FalkorDB" : "Zep Cloud"}
            </Label>
          </div>
        </div>

        {mode === "zep" ? (
          /* Zep Cloud Mode UI */
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center space-x-2">
              <Switch
                id="mode-switch"
                checked={isGroupMode}
                onCheckedChange={setIsGroupMode}
              />
              <Label htmlFor="mode-switch">
                {isGroupMode ? "Group Mode" : "User Mode"}
              </Label>
            </div>

            <div className="flex-1 grid gap-2">
              <Label htmlFor="entity-id">
                {isGroupMode ? "Group ID" : "User ID"}
              </Label>
              <Input
                id="entity-id"
                placeholder={
                  isGroupMode ? "Enter group ID..." : "Enter user ID..."
                }
                value={entityId}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEntityId(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoadingGraph && entityId.trim()) {
                    handleLoadGraph();
                  }
                }}
              />
            </div>

            <Button
              variant="default"
              size="default"
              disabled={isLoadingGraph || !entityId.trim()}
              className="mt-2 sm:mt-0"
              onClick={handleLoadGraph}
            >
              {isLoadingGraph ? (
                <RefreshCw size={16} className="animate-spin mr-1" />
              ) : (
                <Play size={16} className="mr-1" />
              )}
              RUN
            </Button>
          </div>
        ) : (
          /* FalkorDB Mode UI */
          <div className="flex flex-col gap-4">
            {/* Graph Selection and Query Row */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              {/* Graph Selection */}
              <div className="flex-shrink-0 w-full lg:w-64">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="graph-select">Select Graph</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadAvailableGraphs}
                    disabled={isLoadingGraphs || isLoadingGraph}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw
                      size={14}
                      className={isLoadingGraphs ? "animate-spin" : ""}
                    />
                  </Button>
                </div>
                <select
                  id="graph-select"
                  value={selectedGraph}
                  onChange={(e) => setSelectedGraph(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={isLoadingGraphs || isLoadingGraph}
                >
                  <option value="">
                    {isLoadingGraphs ? "Loading..." : "-- Select a graph --"}
                  </option>
                  {availableGraphs.map((graph) => (
                    <option key={graph} value={graph}>
                      {graph}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cypher Query */}
              <div className="flex-1">
                <Label htmlFor="cypher-query" className="text-sm font-medium mb-2 block">
                  Cypher Query
                </Label>
                <div className="flex gap-2">
                  <input
                    id="cypher-query"
                    type="text"
                    value={cypherQuery}
                    onChange={(e) => setCypherQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isLoadingGraph && selectedGraph) {
                        handleRunQuery();
                      }
                    }}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="MATCH (n) OPTIONAL MATCH (n)-[e]-(m) RETURN * LIMIT 100"
                    disabled={isLoadingGraph}
                  />
                  <Button
                    variant="default"
                    size="default"
                    onClick={handleRunQuery}
                    disabled={isLoadingGraph || !selectedGraph}
                    className="px-4"
                  >
                    {isLoadingGraph ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Play size={16} className="mr-1" />
                        RUN
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Loading indicator */}
            {isLoadingGraph && (
              <div className="text-sm text-muted-foreground animate-pulse">
                Loading graph data...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graph Visualization - Takes remaining space */}
      <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border">
        {triplets.length > 0 ? (
          <>
            {/* Graph title bar */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Graph: {currentGraphName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {triplets.length} triplets
                </span>
              </div>
            </div>
            <div className="h-full pt-10">
              <GraphVisualization
                ref={graphRef}
                triplets={triplets}
                zoomOnMount={true}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">No graph loaded</p>
              <p className="text-sm">
                {mode === "falkordb"
                  ? "Select a graph and click RUN to visualize"
                  : "Enter an ID and click RUN to visualize"
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
