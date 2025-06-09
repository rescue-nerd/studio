"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Search, Edit, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";

// Types
interface Country {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  updated_at?: string;
}

interface State {
  id: string;
  name: string;
  country_id: string;
  created_at?: string;
  updated_at?: string;
}

interface City {
  id: string;
  name: string;
  state_id: string;
  created_at?: string;
  updated_at?: string;
}

interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: "Weight" | "Distance" | "Volume" | "Other";
  created_at?: string;
  updated_at?: string;
}

// Default form data
const defaultCountryFormData = { name: "", code: "" };
const defaultStateFormData = { name: "", countryId: "" };
const defaultCityFormData = { name: "", stateId: "" };
const defaultUnitFormData = { name: "", symbol: "", type: "Weight" as const };

export default function LocationsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Loading states
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingStates, setIsLoadingStates] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);

  // Form states
  const [countryFormData, setCountryFormData] = useState(defaultCountryFormData);
  const [stateFormData, setStateFormData] = useState(defaultStateFormData);
  const [cityFormData, setCityFormData] = useState(defaultCityFormData);
  const [unitFormData, setUnitFormData] = useState(defaultUnitFormData);

  // Dialog states
  const [isCountryFormOpen, setIsCountryFormOpen] = useState(false);
  const [isStateFormOpen, setIsStateFormOpen] = useState(false);
  const [isCityFormOpen, setIsCityFormOpen] = useState(false);
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);

  // Edit states
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Delete dialog states
  const [isCountryDeleteDialogOpen, setIsCountryDeleteDialogOpen] = useState(false);
  const [isStateDeleteDialogOpen, setIsStateDeleteDialogOpen] = useState(false);
  const [isCityDeleteDialogOpen, setIsCityDeleteDialogOpen] = useState(false);
  const [isUnitDeleteDialogOpen, setIsUnitDeleteDialogOpen] = useState(false);

  // Items to delete
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  // Search terms
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [citySearchTerm, setCitySearchTerm] = useState("");
  const [unitSearchTerm, setUnitSearchTerm] = useState("");

  // Submission states
  const [isSubmittingCountry, setIsSubmittingCountry] = useState(false);
  const [isSubmittingState, setIsSubmittingState] = useState(false);
  const [isSubmittingCity, setIsSubmittingCity] = useState(false);
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchCountries();
      fetchUnits();
    }
  }, [user]);

  // Fetch states when countries change
  useEffect(() => {
    if (countries.length > 0) {
      fetchStates();
    }
  }, [countries]);

  // Fetch cities when states change
  useEffect(() => {
    if (states.length > 0) {
      fetchCities();
    }
  }, [states]);

  // Fetch functions
  const fetchCountries = async () => {
    setIsLoadingCountries(true);
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCountries(data || []);
    } catch (error) {
      logError(error, "Error fetching countries");
      handleSupabaseError(error, toast);
    } finally {
      setIsLoadingCountries(false);
    }
  };

  const fetchStates = async () => {
    setIsLoadingStates(true);
    try {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setStates(data || []);
    } catch (error) {
      logError(error, "Error fetching states");
      handleSupabaseError(error, toast);
    } finally {
      setIsLoadingStates(false);
    }
  };

  const fetchCities = async () => {
    setIsLoadingCities(true);
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      logError(error, "Error fetching cities");
      handleSupabaseError(error, toast);
    } finally {
      setIsLoadingCities(false);
    }
  };

  const fetchUnits = async () => {
    setIsLoadingUnits(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      logError(error, "Error fetching units");
      handleSupabaseError(error, toast);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  // Form handlers
  const handleCountryInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCountryFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStateFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCityInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCityFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUnitInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUnitFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'countryId') {
      setStateFormData(prev => ({ ...prev, countryId: value }));
    } else if (name === 'stateId') {
      setCityFormData(prev => ({ ...prev, stateId: value }));
    } else if (name === 'type') {
      setUnitFormData(prev => ({ ...prev, type: value as "Weight" | "Distance" | "Volume" | "Other" }));
    }
  };

  // Open form handlers
  const openAddCountryForm = () => {
    setEditingCountry(null);
    setCountryFormData(defaultCountryFormData);
    setIsCountryFormOpen(true);
  };

  const openEditCountryForm = (country: Country) => {
    setEditingCountry(country);
    setCountryFormData({ name: country.name, code: country.code });
    setIsCountryFormOpen(true);
  };

  const openAddStateForm = () => {
    setEditingState(null);
    setStateFormData({ ...defaultStateFormData, countryId: countries[0]?.id || "" });
    setIsStateFormOpen(true);
  };

  const openEditStateForm = (state: State) => {
    setEditingState(state);
    setStateFormData({ name: state.name, countryId: state.country_id });
    setIsStateFormOpen(true);
  };

  const openAddCityForm = () => {
    setEditingCity(null);
    setCityFormData({ ...defaultCityFormData, stateId: states[0]?.id || "" });
    setIsCityFormOpen(true);
  };

  const openEditCityForm = (city: City) => {
    setEditingCity(city);
    setCityFormData({ name: city.name, stateId: city.state_id });
    setIsCityFormOpen(true);
  };

  const openAddUnitForm = () => {
    setEditingUnit(null);
    setUnitFormData(defaultUnitFormData);
    setIsUnitFormOpen(true);
  };

  const openEditUnitForm = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitFormData({ name: unit.name, symbol: unit.symbol, type: unit.type });
    setIsUnitFormOpen(true);
  };

  // Delete handlers
  const handleDeleteCountryClick = (country: Country) => {
    setCountryToDelete(country);
    setIsCountryDeleteDialogOpen(true);
  };

  const handleDeleteStateClick = (state: State) => {
    setStateToDelete(state);
    setIsStateDeleteDialogOpen(true);
  };

  const handleDeleteCityClick = (city: City) => {
    setCityToDelete(city);
    setIsCityDeleteDialogOpen(true);
  };

  const handleDeleteUnitClick = (unit: Unit) => {
    setUnitToDelete(unit);
    setIsUnitDeleteDialogOpen(true);
  };

  // Submit handlers
  const handleCountrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!countryFormData.name || !countryFormData.code) {
      toast({ title: "Validation Error", description: "Name and code are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingCountry(true);
    
    try {
      if (editingCountry) {
        // Update existing country
        const response = await supabase
          .from('countries')
          .update({
            name: countryFormData.name,
            code: countryFormData.code
          })
          .eq('id', editingCountry.id)
          .select();
        
        if (response.error) throw response.error;
        
        toast({ title: "Success", description: "Country updated successfully." });
      } else {
        // Create new country
        const response = await supabase
          .from('countries')
          .insert({
            name: countryFormData.name,
            code: countryFormData.code
          })
          .select();
        
        if (response.error) throw response.error;
        
        toast({ title: "Success", description: "Country created successfully." });
      }
      
      fetchCountries();
      setIsCountryFormOpen(false);
    } catch (error) {
      logError(error, "Error saving country");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCountry(false);
    }
  };

  const handleStateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stateFormData.name || !stateFormData.countryId) {
      toast({ title: "Validation Error", description: "Name and country are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingState(true);
    
    try {
      if (editingState) {
        // Update existing state using Edge Function
        const response = await supabase.functions.invoke('update-state', {
          body: {
            id: editingState.id,
            name: stateFormData.name,
            countryId: stateFormData.countryId
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: response.data.message || "State updated successfully." });
          fetchStates();
          setIsStateFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update state");
        }
      } else {
        // Create new state using Edge Function
        const response = await supabase.functions.invoke('create-state', {
          body: {
            name: stateFormData.name,
            countryId: stateFormData.countryId
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: response.data.message || "State created successfully." });
          fetchStates();
          setIsStateFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to create state");
        }
      }
    } catch (error) {
      logError(error, "Error saving state");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingState(false);
    }
  };

  const handleCitySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cityFormData.name || !cityFormData.stateId) {
      toast({ title: "Validation Error", description: "Name and state are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingCity(true);
    
    try {
      if (editingCity) {
        // Update existing city using Edge Function
        const response = await supabase.functions.invoke('update-city', {
          body: {
            cityId: editingCity.id,
            name: cityFormData.name,
            stateId: cityFormData.stateId
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: response.data.message || "City updated successfully." });
          fetchCities();
          setIsCityFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update city");
        }
      } else {
        // Create new city using Edge Function
        const response = await supabase.functions.invoke('create-city', {
          body: {
            name: cityFormData.name,
            stateId: cityFormData.stateId
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: response.data.message || "City created successfully." });
          fetchCities();
          setIsCityFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to create city");
        }
      }
    } catch (error) {
      logError(error, "Error saving city");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCity(false);
    }
  };

  const handleUnitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!unitFormData.name || !unitFormData.symbol || !unitFormData.type) {
      toast({ title: "Validation Error", description: "Name, symbol, and type are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingUnit(true);
    
    try {
      if (editingUnit) {
        // Update existing unit using Edge Function
        const response = await supabase.functions.invoke('update-unit', {
          body: {
            id: editingUnit.id,
            name: unitFormData.name,
            symbol: unitFormData.symbol,
            type: unitFormData.type
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Unit updated successfully." });
          fetchUnits();
          setIsUnitFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update unit");
        }
      } else {
        // Create new unit using Edge Function
        const response = await supabase.functions.invoke('create-unit', {
          body: {
            name: unitFormData.name,
            symbol: unitFormData.symbol,
            type: unitFormData.type
          }
        });
        
        if (response.error) throw response.error;
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Unit created successfully." });
          fetchUnits();
          setIsUnitFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to create unit");
        }
      }
    } catch (error) {
      logError(error, "Error saving unit");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingUnit(false);
    }
  };

  // Delete confirmation handlers
  const confirmDeleteCountry = async () => {
    if (!countryToDelete) return;
    
    try {
      const response = await supabase.functions.invoke('delete-country', {
        body: { id: countryToDelete.id }
      });
      
      if (response.error) throw response.error;
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "Country deleted successfully." });
        fetchCountries();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete country");
      }
    } catch (error) {
      logError(error, "Error deleting country");
      handleSupabaseError(error, toast, {
        "associated states": "Cannot delete country with associated states. Delete the states first."
      });
    } finally {
      setIsCountryDeleteDialogOpen(false);
      setCountryToDelete(null);
    }
  };

  const confirmDeleteState = async () => {
    if (!stateToDelete) return;
    
    try {
      const response = await supabase.functions.invoke('delete-state', {
        body: { id: stateToDelete.id }
      });
      
      if (response.error) throw response.error;
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: response.data.message || "State deleted successfully." });
        fetchStates();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete state");
      }
    } catch (error) {
      logError(error, "Error deleting state");
      handleSupabaseError(error, toast, {
        "associated cities": "Cannot delete state with associated cities. Delete the cities first."
      });
    } finally {
      setIsStateDeleteDialogOpen(false);
      setStateToDelete(null);
    }
  };

  const confirmDeleteCity = async () => {
    if (!cityToDelete) return;
    
    try {
      const response = await supabase.functions.invoke('delete-city', {
        body: { cityId: cityToDelete.id }
      });
      
      if (response.error) throw response.error;
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: response.data.message || "City deleted successfully." });
        fetchCities();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete city");
      }
    } catch (error) {
      logError(error, "Error deleting city");
      handleSupabaseError(error, toast);
    } finally {
      setIsCityDeleteDialogOpen(false);
      setCityToDelete(null);
    }
  };

  const confirmDeleteUnit = async () => {
    if (!unitToDelete) return;
    
    try {
      const response = await supabase.functions.invoke('delete-unit', {
        body: { id: unitToDelete.id }
      });
      
      if (response.error) throw response.error;
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "Unit deleted successfully." });
        fetchUnits();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete unit");
      }
    } catch (error) {
      logError(error, "Error deleting unit");
      handleSupabaseError(error, toast);
    } finally {
      setIsUnitDeleteDialogOpen(false);
      setUnitToDelete(null);
    }
  };

  // Filter data based on search terms
  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearchTerm.toLowerCase())
  );

  const filteredStates = states.filter(state => 
    state.name.toLowerCase().includes(stateSearchTerm.toLowerCase()) ||
    countries.find(c => c.id === state.country_id)?.name.toLowerCase().includes(stateSearchTerm.toLowerCase())
  );

  const filteredCities = cities.filter(city => 
    city.name.toLowerCase().includes(citySearchTerm.toLowerCase()) ||
    states.find(s => s.id === city.state_id)?.name.toLowerCase().includes(citySearchTerm.toLowerCase())
  );

  const filteredUnits = units.filter(unit => 
    unit.name.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
    unit.symbol.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
    unit.type.toLowerCase().includes(unitSearchTerm.toLowerCase())
  );

  // Helper functions
  const getCountryNameById = (id: string) => {
    return countries.find(country => country.id === id)?.name || "N/A";
  };

  const getStateNameById = (id: string) => {
    return states.find(state => state.id === id)?.name || "N/A";
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Authenticating..." : "Redirecting to login..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Locations & Units</h1>
        <p className="text-muted-foreground">Manage countries, states, cities, and measurement units.</p>
      </div>

      <Tabs defaultValue="countries" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        {/* Countries Tab */}
        <TabsContent value="countries">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline text-xl">Countries</CardTitle>
                  <CardDescription>Manage countries for your operations.</CardDescription>
                </div>
                <Dialog open={isCountryFormOpen} onOpenChange={setIsCountryFormOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddCountryForm} disabled={isSubmittingCountry}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Country
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCountry ? "Edit Country" : "Add Country"}</DialogTitle>
                      <DialogDescription>
                        {editingCountry ? "Update country details." : "Add a new country to the system."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCountrySubmit}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="countryName" className="text-right">Name</Label>
                          <Input
                            id="countryName"
                            name="name"
                            value={countryFormData.name}
                            onChange={handleCountryInputChange}
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="countryCode" className="text-right">Code</Label>
                          <Input
                            id="countryCode"
                            name="code"
                            value={countryFormData.code}
                            onChange={handleCountryInputChange}
                            className="col-span-3"
                            required
                            maxLength={3}
                            placeholder="e.g., US, UK, IN"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingCountry}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingCountry}>
                          {isSubmittingCountry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingCountry ? "Update" : "Add"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search countries..."
                  className="pl-8"
                  value={countrySearchTerm}
                  onChange={(e) => setCountrySearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCountries ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading countries...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCountries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No countries found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredCountries.map((country) => (
                        <TableRow key={country.id}>
                          <TableCell className="font-medium">{country.name}</TableCell>
                          <TableCell>{country.code}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditCountryForm(country)}
                                disabled={isSubmittingCountry}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog
                                open={isCountryDeleteDialogOpen && countryToDelete?.id === country.id}
                                onOpenChange={(open) => {
                                  if (!open) setCountryToDelete(null);
                                  setIsCountryDeleteDialogOpen(open);
                                }}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteCountryClick(country)}
                                    disabled={isSubmittingCountry}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the country "{countryToDelete?.name}".
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDeleteCountry}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* States Tab */}
        <TabsContent value="states">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline text-xl">States</CardTitle>
                  <CardDescription>Manage states/provinces for your operations.</CardDescription>
                </div>
                <Dialog open={isStateFormOpen} onOpenChange={setIsStateFormOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddStateForm} disabled={isSubmittingState || countries.length === 0}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add State
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingState ? "Edit State" : "Add State"}</DialogTitle>
                      <DialogDescription>
                        {editingState ? "Update state details." : "Add a new state to the system."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleStateSubmit}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="stateName" className="text-right">Name</Label>
                          <Input
                            id="stateName"
                            name="name"
                            value={stateFormData.name}
                            onChange={handleStateInputChange}
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="stateCountry" className="text-right">Country</Label>
                          <Select
                            value={stateFormData.countryId}
                            onValueChange={(value) => handleSelectChange('countryId', value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country.id} value={country.id}>
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingState}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingState}>
                          {isSubmittingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingState ? "Update" : "Add"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search states..."
                  className="pl-8"
                  value={stateSearchTerm}
                  onChange={(e) => setStateSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStates ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading states...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No states found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredStates.map((state) => (
                        <TableRow key={state.id}>
                          <TableCell className="font-medium">{state.name}</TableCell>
                          <TableCell>{getCountryNameById(state.country_id)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditStateForm(state)}
                                disabled={isSubmittingState}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog
                                open={isStateDeleteDialogOpen && stateToDelete?.id === state.id}
                                onOpenChange={(open) => {
                                  if (!open) setStateToDelete(null);
                                  setIsStateDeleteDialogOpen(open);
                                }}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteStateClick(state)}
                                    disabled={isSubmittingState}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the state "{stateToDelete?.name}".
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDeleteState}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="cities">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline text-xl">Cities</CardTitle>
                  <CardDescription>Manage cities for your operations.</CardDescription>
                </div>
                <Dialog open={isCityFormOpen} onOpenChange={setIsCityFormOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddCityForm} disabled={isSubmittingCity || states.length === 0}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add City
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCity ? "Edit City" : "Add City"}</DialogTitle>
                      <DialogDescription>
                        {editingCity ? "Update city details." : "Add a new city to the system."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCitySubmit}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="cityName" className="text-right">Name</Label>
                          <Input
                            id="cityName"
                            name="name"
                            value={cityFormData.name}
                            onChange={handleCityInputChange}
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="cityState" className="text-right">State</Label>
                          <Select
                            value={cityFormData.stateId}
                            onValueChange={(value) => handleSelectChange('stateId', value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state.id} value={state.id}>
                                  {state.name} ({getCountryNameById(state.country_id)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingCity}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingCity}>
                          {isSubmittingCity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingCity ? "Update" : "Add"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cities..."
                  className="pl-8"
                  value={citySearchTerm}
                  onChange={(e) => setCitySearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCities ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading cities...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No cities found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredCities.map((city) => {
                        const state = states.find(s => s.id === city.state_id);
                        return (
                          <TableRow key={city.id}>
                            <TableCell className="font-medium">{city.name}</TableCell>
                            <TableCell>{getStateNameById(city.state_id)}</TableCell>
                            <TableCell>{state ? getCountryNameById(state.country_id) : "N/A"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEditCityForm(city)}
                                  disabled={isSubmittingCity}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog
                                  open={isCityDeleteDialogOpen && cityToDelete?.id === city.id}
                                  onOpenChange={(open) => {
                                    if (!open) setCityToDelete(null);
                                    setIsCityDeleteDialogOpen(open);
                                  }}
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => handleDeleteCityClick(city)}
                                      disabled={isSubmittingCity}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the city "{cityToDelete?.name}".
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={confirmDeleteCity}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline text-xl">Units</CardTitle>
                  <CardDescription>Manage measurement units for your operations.</CardDescription>
                </div>
                <Dialog open={isUnitFormOpen} onOpenChange={setIsUnitFormOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddUnitForm} disabled={isSubmittingUnit}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
                      <DialogDescription>
                        {editingUnit ? "Update unit details." : "Add a new measurement unit to the system."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUnitSubmit}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="unitName" className="text-right">Name</Label>
                          <Input
                            id="unitName"
                            name="name"
                            value={unitFormData.name}
                            onChange={handleUnitInputChange}
                            className="col-span-3"
                            required
                            placeholder="e.g., Kilogram, Meter"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="unitSymbol" className="text-right">Symbol</Label>
                          <Input
                            id="unitSymbol"
                            name="symbol"
                            value={unitFormData.symbol}
                            onChange={handleUnitInputChange}
                            className="col-span-3"
                            required
                            placeholder="e.g., kg, m"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="unitType" className="text-right">Type</Label>
                          <Select
                            value={unitFormData.type}
                            onValueChange={(value) => handleSelectChange('type', value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Weight">Weight</SelectItem>
                              <SelectItem value="Distance">Distance</SelectItem>
                              <SelectItem value="Volume">Volume</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingUnit}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingUnit}>
                          {isSubmittingUnit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingUnit ? "Update" : "Add"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search units..."
                  className="pl-8"
                  value={unitSearchTerm}
                  onChange={(e) => setUnitSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingUnits ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading units...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No units found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredUnits.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">{unit.name}</TableCell>
                          <TableCell>{unit.symbol}</TableCell>
                          <TableCell>{unit.type}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditUnitForm(unit)}
                                disabled={isSubmittingUnit}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog
                                open={isUnitDeleteDialogOpen && unitToDelete?.id === unit.id}
                                onOpenChange={(open) => {
                                  if (!open) setUnitToDelete(null);
                                  setIsUnitDeleteDialogOpen(open);
                                }}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteUnitClick(unit)}
                                    disabled={isSubmittingUnit}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the unit "{unitToDelete?.name}".
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDeleteUnit}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}