"use client";

import { useState, ChangeEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2, RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  const [graphDialogOpen, setGraphDialogOpen] = useState(false);
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
      if (data.graphs?.length > 0 && !selectedGraph) {
        setSelectedGraph(data.graphs[0]);
      }
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

  // Auto-load graph when selection changes in FalkorDB mode
  useEffect(() => {
    if (mode === "falkordb" && selectedGraph) {
      handleLoadFalkorDBGraph(selectedGraph);
    }
  }, [selectedGraph, mode]);

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
      setGraphDialogOpen(true);
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
    }
  };

  const handleLoadGraph = async () => {
    if (mode === "zep") {
      if (!entityId.trim()) {
        toast.error("Please enter an ID");
        return;
      }
    } else {
      if (!selectedGraph) {
        toast.error("Please select a graph");
        return;
      }
    }

    setIsLoadingGraph(true);
    try {
      let response;

      if (mode === "zep") {
        const endpointType = isGroupMode ? "group" : "user";
        response = await fetch(
          `/api/graph/${endpointType}/${encodeURIComponent(entityId)}/triplets`
        );
      } else {
        response = await fetch(
          `/api/falkordb/${encodeURIComponent(selectedGraph)}/triplets`
        );
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load graph");
      }

      const data = await response.json();
      setTriplets(data.triplets);

      // Open the dialog when graph data is loaded
      setGraphDialogOpen(true);
    } catch (error) {
      console.error("Error loading graph:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load graph"
      );
    } finally {
      setIsLoadingGraph(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 py-4">
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
              />
            </div>

            <Button
              variant="default"
              size="lg"
              disabled={isLoadingGraph}
              className="mt-2 sm:mt-0 text-lg font-medium"
              onClick={handleLoadGraph}
            >
              {isLoadingGraph ? (
                "Loading..."
              ) : (
                <>
                  <span className="mr-2">View Graph</span>
                  <Share2 size={19} />
                </>
              )}
            </Button>
          </div>
        ) : (
          /* FalkorDB Mode UI */
          <div className="flex flex-col gap-4">
            {/* Graph Selection Row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1 grid gap-2">
                <div className="flex items-center gap-2">
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
                  {isLoadingGraph && (
                    <span className="text-sm text-muted-foreground animate-pulse">
                      Loading graph...
                    </span>
                  )}
                </div>
                <select
                  id="graph-select"
                  value={selectedGraph}
                  onChange={(e) => setSelectedGraph(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={isLoadingGraphs || isLoadingGraph}
                >
                  {availableGraphs.length === 0 ? (
                    <option value="">
                      {isLoadingGraphs ? "Loading..." : "No graphs available"}
                    </option>
                  ) : (
                    availableGraphs.map((graph) => (
                      <option key={graph} value={graph}>
                        {graph}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Show View Graph button only if dialog is closed and we have triplets */}
              {!graphDialogOpen && triplets.length > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setGraphDialogOpen(true)}
                  className="mt-2 sm:mt-0"
                >
                  <span className="mr-2">Show Graph</span>
                  <Share2 size={19} />
                </Button>
              )}
            </div>

            {/* Cypher Query Row */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="cypher-query" className="text-sm font-medium">
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
        )}
      </div>

      {/* Graph Dialog */}
      <Dialog open={graphDialogOpen} onOpenChange={setGraphDialogOpen}>
        <DialogContent className="max-w-none sm:max-w-none md:max-w-none lg:max-w-none w-[100vw] h-[100vh]">
          <DialogHeader>
            <DialogTitle>
              {mode === "zep"
                ? `${isGroupMode ? "Group" : "User"} Relationship Graph`
                : `Graph: ${selectedGraph}`}
            </DialogTitle>
            <DialogDescription>
              {mode === "zep"
                ? `Visualization of ${isGroupMode ? "group" : "user"} relationships and connections`
                : `Visualization of the ${selectedGraph} graph from FalkorDB`}
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 w-full h-[calc(80vh-8rem)]">
            {triplets.length > 0 && (
              <GraphVisualization
                ref={graphRef}
                triplets={triplets}
                zoomOnMount={true}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGraphDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
