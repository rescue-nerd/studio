"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { optimizeRoute, type OptimizeRouteInput, type OptimizeRouteOutput } from "@/ai/flows/optimize-route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Lightbulb, MapPinned, Package, Clock, Fuel } from "lucide-react";

export default function RouteOptimizationPage() {
  const [historicalData, setHistoricalData] = useState("");
  const [realTimeConditions, setRealTimeConditions] = useState("");
  const [deliveryConstraints, setDeliveryConstraints] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OptimizeRouteOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const input: OptimizeRouteInput = {
        historicalData,
        realTimeConditions,
        deliveryConstraints,
      };
      const output = await optimizeRoute(input);
      setResults(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      console.error("Optimization error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Smart Route Optimization</h1>
        <p className="text-muted-foreground">Leverage AI to find the most efficient routes and load configurations.</p>
      </div>

      <Card className="shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Optimization Inputs</CardTitle>
            <CardDescription>Provide data for the AI to generate suggestions. All inputs should be in JSON format.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="historicalData">Historical Data (JSON)</Label>
              <Textarea
                id="historicalData"
                value={historicalData}
                onChange={(e) => setHistoricalData(e.target.value)}
                placeholder='{"routes": [{"id": "R001", "avg_time_hours": 5, "fuel_cost": 150.75, "load_kg": 5000}], "weather_impact": {"rain": 1.2, "snow": 1.5}}'
                rows={5}
                className="font-code"
              />
            </div>
            <div>
              <Label htmlFor="realTimeConditions">Real-Time Conditions (JSON)</Label>
              <Textarea
                id="realTimeConditions"
                value={realTimeConditions}
                onChange={(e) => setRealTimeConditions(e.target.value)}
                placeholder='{"traffic": {"highway_A": "heavy", "city_center": "moderate"}, "weather": {"current": "clear", "temp_celsius": 25}, "road_closures": ["Bridge_X"]}'
                rows={5}
                className="font-code"
              />
            </div>
            <div>
              <Label htmlFor="deliveryConstraints">Delivery Constraints (JSON)</Label>
              <Textarea
                id="deliveryConstraints"
                value={deliveryConstraints}
                onChange={(e) => setDeliveryConstraints(e.target.value)}
                placeholder='{"time_windows": [{"order_id": "ORD001", "start_time": "09:00", "end_time": "12:00"}], "vehicle_capacity_kg": 10000, "max_stops": 10}'
                rows={5}
                className="font-code"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Optimize Routes
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && results.suggestions && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Optimization Results</CardTitle>
            <CardDescription>AI-powered route and load suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.suggestions.length === 0 && <p>No suggestions available for the given input.</p>}
            {results.suggestions.map((suggestion, index) => (
              <Card key={index} className="bg-secondary/50 p-4 rounded-md">
                <CardTitle className="text-lg font-medium mb-2 text-primary">Suggestion {index + 1}</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold flex items-center"><MapPinned className="mr-2 h-4 w-4 text-muted-foreground"/>Route:</h4>
                    <p className="font-code bg-muted p-2 rounded text-xs">{suggestion.route.join(' -&gt; ')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground"/>Load Configuration:</h4>
                    <pre className="font-code bg-muted p-2 rounded text-xs whitespace-pre-wrap">
                      {JSON.stringify(suggestion.loadConfiguration, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground"/>Est. Delivery Time:</h4>
                    <p>{suggestion.estimatedDeliveryTime}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center"><Fuel className="mr-2 h-4 w-4 text-muted-foreground"/>Est. Fuel Cost:</h4>
                    <p>${suggestion.estimatedFuelCost.toFixed(2)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
