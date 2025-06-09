"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError, logError } from "@/lib/supabase-error-handler";
import { Edit, Loader2, MapPin, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

// Types for locations
interface Country {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

interface State {
  id: string;
  name: string;
  country_id: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

interface City {
  id: string;
  name: string;
  state_id: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

// Types for units
interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: "Weight" | "Distance" | "Volume" | "Other";
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

// Default form data
const defaultCountryFormData = {
  name: "",
  code: "",
};

const defaultStateFormData = {
  name: "",
  countryId: "",
};

const defaultCityFormData = {
  name: "",
  stateId: "",
};

const defaultUnitFormData = {
  name: "",
  symbol: "",
  type: "Weight" as const,
};

export default function LocationsPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // States for countries
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const [isCountryFormOpen, setIsCountryFormOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [countryFormData, setCountryFormData] = useState(defaultCountryFormData);
  const [isCountryDeleteAlertOpen, setIsCountryDeleteAlertOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isSubmittingCountry, setIsSubmittingCountry] = useState(false);

  // States for states
  const [states, setStates] = useState<State[]>([]);
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [isStateFormOpen, setIsStateFormOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [stateFormData, setStateFormData] = useState(defaultStateFormData);
  const [isStateDeleteAlertOpen, setIsStateDeleteAlertOpen] = useState(false);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);
  const [isLoadingStates, setIsLoadingStates] = useState(true);
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  // States for cities
  const [cities, setCities] = useState<City[]>([]);
  const [citySearchTerm, setCitySearchTerm] = useState("");
  const [isCityFormOpen, setIsCityFormOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityFormData, setCityFormData] = useState(defaultCityFormData);
  const [isCityDeleteAlertOpen, setIsCityDeleteAlertOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isSubmittingCity, setIsSubmittingCity] = useState(false);

  // States for units
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSearchTerm, setUnitSearchTerm] = useState("");
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitFormData, setUnitFormData] = useState(defaultUnitFormData);
  const [isUnitDeleteAlertOpen, setIsUnitDeleteAlertOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (authUser) {
      fetchCountries();
      fetchStates();
      fetchCities();
      fetchUnits();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Fetch countries
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

  // Fetch states
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

  // Fetch cities
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

  // Fetch units
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

  // Country form handlers
  const handleCountryInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCountryFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddCountryForm = () => {
    setEditingCountry(null);
    setCountryFormData(defaultCountryFormData);
    setIsCountryFormOpen(true);
  };

  const openEditCountryForm = (country: Country) => {
    setEditingCountry(country);
    setCountryFormData({
      name: country.name,
      code: country.code,
    });
    setIsCountryFormOpen(true);
  };

  const handleCountrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!countryFormData.name || !countryFormData.code) {
      toast({ title: "Validation Error", description: "Name and code are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingCountry(true);
    
    try {
      if (editingCountry) {
        // Update existing country
        const response = await supabase.functions.invoke('update-country', {
          body: {
            id: editingCountry.id,
            name: countryFormData.name,
            code: countryFormData.code,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Country updated successfully" });
          fetchCountries();
          setIsCountryFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update country");
        }
      } else {
        // Create new country
        const response = await supabase.functions.invoke('create-country', {
          body: {
            name: countryFormData.name,
            code: countryFormData.code,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Country created successfully" });
          fetchCountries();
          setIsCountryFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to create country");
        }
      }
    } catch (error) {
      logError(error, "Error saving country");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCountry(false);
    }
  };

  const handleCountryDeleteClick = (country: Country) => {
    setCountryToDelete(country);
    setIsCountryDeleteAlertOpen(true);
  };

  const confirmCountryDelete = async () => {
    if (!countryToDelete) return;
    
    setIsSubmittingCountry(true);
    
    try {
      const response = await supabase.functions.invoke('delete-country', {
        body: {
          id: countryToDelete.id,
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "Country deleted successfully" });
        fetchCountries();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete country");
      }
    } catch (error) {
      logError(error, "Error deleting country");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCountry(false);
      setIsCountryDeleteAlertOpen(false);
      setCountryToDelete(null);
    }
  };

  // State form handlers
  const handleStateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStateFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStateSelectChange = (value: string) => {
    setStateFormData(prev => ({ ...prev, countryId: value }));
  };

  const openAddStateForm = () => {
    setEditingState(null);
    setStateFormData({
      ...defaultStateFormData,
      countryId: countries.length > 0 ? countries[0].id : "",
    });
    setIsStateFormOpen(true);
  };

  const openEditStateForm = (state: State) => {
    setEditingState(state);
    setStateFormData({
      name: state.name,
      countryId: state.country_id,
    });
    setIsStateFormOpen(true);
  };

  const handleStateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!stateFormData.name || !stateFormData.countryId) {
      toast({ title: "Validation Error", description: "Name and country are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingState(true);
    
    try {
      if (editingState) {
        // Update existing state
        const response = await supabase.functions.invoke('update-state', {
          body: {
            id: editingState.id,
            name: stateFormData.name,
            countryId: stateFormData.countryId,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "State updated successfully" });
          fetchStates();
          setIsStateFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update state");
        }
      } else {
        // Create new state
        const response = await supabase.functions.invoke('create-state', {
          body: {
            name: stateFormData.name,
            countryId: stateFormData.countryId,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "State created successfully" });
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

  const handleStateDeleteClick = (state: State) => {
    setStateToDelete(state);
    setIsStateDeleteAlertOpen(true);
  };

  const confirmStateDelete = async () => {
    if (!stateToDelete) return;
    
    setIsSubmittingState(true);
    
    try {
      const response = await supabase.functions.invoke('delete-state', {
        body: {
          id: stateToDelete.id,
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "State deleted successfully" });
        fetchStates();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete state");
      }
    } catch (error) {
      logError(error, "Error deleting state");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingState(false);
      setIsStateDeleteAlertOpen(false);
      setStateToDelete(null);
    }
  };

  // City form handlers
  const handleCityInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCityFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCitySelectChange = (value: string) => {
    setCityFormData(prev => ({ ...prev, stateId: value }));
  };

  const openAddCityForm = () => {
    setEditingCity(null);
    setCityFormData({
      ...defaultCityFormData,
      stateId: states.length > 0 ? states[0].id : "",
    });
    setIsCityFormOpen(true);
  };

  const openEditCityForm = (city: City) => {
    setEditingCity(city);
    setCityFormData({
      name: city.name,
      stateId: city.state_id,
    });
    setIsCityFormOpen(true);
  };

  const handleCitySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!cityFormData.name || !cityFormData.stateId) {
      toast({ title: "Validation Error", description: "Name and state are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingCity(true);
    
    try {
      if (editingCity) {
        // Update existing city
        const response = await supabase.functions.invoke('update-city', {
          body: {
            cityId: editingCity.id,
            name: cityFormData.name,
            stateId: cityFormData.stateId,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "City updated successfully" });
          fetchCities();
          setIsCityFormOpen(false);
        } else {
          throw new Error(response.data?.message || "Failed to update city");
        }
      } else {
        // Create new city
        const response = await supabase.functions.invoke('create-city', {
          body: {
            name: cityFormData.name,
            stateId: cityFormData.stateId,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "City created successfully" });
          fetchCities();
          setIsCityFormOpen(false);
        } else {
          throw new Error(response.data?.message || "Failed to create city");
        }
      }
    } catch (error) {
      logError(error, "Error saving city");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCity(false);
    }
  };

  const handleCityDeleteClick = (city: City) => {
    setCityToDelete(city);
    setIsCityDeleteAlertOpen(true);
  };

  const confirmCityDelete = async () => {
    if (!cityToDelete) return;
    
    setIsSubmittingCity(true);
    
    try {
      const response = await supabase.functions.invoke('delete-city', {
        body: {
          cityId: cityToDelete.id,
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "City deleted successfully" });
        fetchCities();
      } else {
        throw new Error(response.data?.message || "Failed to delete city");
      }
    } catch (error) {
      logError(error, "Error deleting city");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingCity(false);
      setIsCityDeleteAlertOpen(false);
      setCityToDelete(null);
    }
  };

  // Unit form handlers
  const handleUnitInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUnitFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUnitTypeChange = (value: string) => {
    setUnitFormData(prev => ({ ...prev, type: value as Unit["type"] }));
  };

  const openAddUnitForm = () => {
    setEditingUnit(null);
    setUnitFormData(defaultUnitFormData);
    setIsUnitFormOpen(true);
  };

  const openEditUnitForm = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitFormData({
      name: unit.name,
      symbol: unit.symbol,
      type: unit.type,
    });
    setIsUnitFormOpen(true);
  };

  const handleUnitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!unitFormData.name || !unitFormData.symbol || !unitFormData.type) {
      toast({ title: "Validation Error", description: "Name, symbol, and type are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingUnit(true);
    
    try {
      if (editingUnit) {
        // Update existing unit
        const response = await supabase.functions.invoke('update-unit', {
          body: {
            id: editingUnit.id,
            name: unitFormData.name,
            symbol: unitFormData.symbol,
            type: unitFormData.type,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Unit updated successfully" });
          fetchUnits();
          setIsUnitFormOpen(false);
        } else {
          throw new Error(response.data?.error?.message || "Failed to update unit");
        }
      } else {
        // Create new unit
        const response = await supabase.functions.invoke('create-unit', {
          body: {
            name: unitFormData.name,
            symbol: unitFormData.symbol,
            type: unitFormData.type,
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message);
        }
        
        if (response.data && response.data.success) {
          toast({ title: "Success", description: "Unit created successfully" });
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

  const handleUnitDeleteClick = (unit: Unit) => {
    setUnitToDelete(unit);
    setIsUnitDeleteAlertOpen(true);
  };

  const confirmUnitDelete = async () => {
    if (!unitToDelete) return;
    
    setIsSubmittingUnit(true);
    
    try {
      const response = await supabase.functions.invoke('delete-unit', {
        body: {
          id: unitToDelete.id,
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (response.data && response.data.success) {
        toast({ title: "Success", description: "Unit deleted successfully" });
        fetchUnits();
      } else {
        throw new Error(response.data?.error?.message || "Failed to delete unit");
      }
    } catch (error) {
      logError(error, "Error deleting unit");
      handleSupabaseError(error, toast);
    } finally {
      setIsSubmittingUnit(false);
      setIsUnitDeleteAlertOpen(false);
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
  const getCountryName = (countryId: string) => {
    return countries.find(c => c.id === countryId)?.name || "N/A";
  };

  const getStateName = (stateId: string) => {
    return states.find(s => s.id === stateId)?.name || "N/A";
  };

  if (authLoading || (!authUser && !authLoading)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Authenticating..." : "Redirecting to login..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground flex items-center"><MapPin className="mr-3 h-8 w-8 text-primary"/>Locations & Units</h1>
          <p className="text-muted-foreground ml-11">Manage countries, states, cities, and measurement units.</p>
        </div>
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
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingCountry ? "Edit Country" : "Add Country"}</DialogTitle>
                      <DialogDescription>
                        {editingCountry ? "Update country details." : "Enter details for the new country."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCountrySubmit} className="space-y-4 py-4">
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
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingCountry}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingCountry}>
                          {isSubmittingCountry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingCountry ? "Update Country" : "Add Country"}
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
                    {filteredCountries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No countries found.</TableCell>
                      </TableRow>
                    )}
                    {filteredCountries.map((country) => (
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
                              open={isCountryDeleteAlertOpen && countryToDelete?.id === country.id}
                              onOpenChange={(open) => {
                                if (!open) setCountryToDelete(null);
                                setIsCountryDeleteAlertOpen(open);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleCountryDeleteClick(country)}
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
                                  <AlertDialogCancel disabled={isSubmittingCountry}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmCountryDelete} disabled={isSubmittingCountry}>
                                    {isSubmittingCountry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingState ? "Edit State" : "Add State"}</DialogTitle>
                      <DialogDescription>
                        {editingState ? "Update state details." : "Enter details for the new state."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleStateSubmit} className="space-y-4 py-4">
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
                          onValueChange={handleStateSelectChange}
                          disabled={countries.length === 0}
                        >
                          <SelectTrigger id="stateCountry" className="col-span-3">
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
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingState}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingState || countries.length === 0}>
                          {isSubmittingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingState ? "Update State" : "Add State"}
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
                    {filteredStates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No states found.</TableCell>
                      </TableRow>
                    )}
                    {filteredStates.map((state) => (
                      <TableRow key={state.id}>
                        <TableCell className="font-medium">{state.name}</TableCell>
                        <TableCell>{getCountryName(state.country_id)}</TableCell>
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
                              open={isStateDeleteAlertOpen && stateToDelete?.id === state.id}
                              onOpenChange={(open) => {
                                if (!open) setStateToDelete(null);
                                setIsStateDeleteAlertOpen(open);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleStateDeleteClick(state)}
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
                                  <AlertDialogCancel disabled={isSubmittingState}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmStateDelete} disabled={isSubmittingState}>
                                    {isSubmittingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingCity ? "Edit City" : "Add City"}</DialogTitle>
                      <DialogDescription>
                        {editingCity ? "Update city details." : "Enter details for the new city."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCitySubmit} className="space-y-4 py-4">
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
                          onValueChange={handleCitySelectChange}
                          disabled={states.length === 0}
                        >
                          <SelectTrigger id="cityState" className="col-span-3">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {states.map((state) => (
                              <SelectItem key={state.id} value={state.id}>
                                {state.name} ({getCountryName(state.country_id)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingCity}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingCity || states.length === 0}>
                          {isSubmittingCity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingCity ? "Update City" : "Add City"}
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
                    {filteredCities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No cities found.</TableCell>
                      </TableRow>
                    )}
                    {filteredCities.map((city) => {
                      const state = states.find(s => s.id === city.state_id);
                      return (
                        <TableRow key={city.id}>
                          <TableCell className="font-medium">{city.name}</TableCell>
                          <TableCell>{getStateName(city.state_id)}</TableCell>
                          <TableCell>{state ? getCountryName(state.country_id) : "N/A"}</TableCell>
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
                                open={isCityDeleteAlertOpen && cityToDelete?.id === city.id}
                                onOpenChange={(open) => {
                                  if (!open) setCityToDelete(null);
                                  setIsCityDeleteAlertOpen(open);
                                }}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleCityDeleteClick(city)}
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
                                    <AlertDialogCancel disabled={isSubmittingCity}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmCityDelete} disabled={isSubmittingCity}>
                                      {isSubmittingCity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
                      <DialogDescription>
                        {editingUnit ? "Update unit details." : "Enter details for the new unit."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUnitSubmit} className="space-y-4 py-4">
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
                          onValueChange={handleUnitTypeChange}
                        >
                          <SelectTrigger id="unitType" className="col-span-3">
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
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" disabled={isSubmittingUnit}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingUnit}>
                          {isSubmittingUnit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingUnit ? "Update Unit" : "Add Unit"}
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
                    {filteredUnits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No units found.</TableCell>
                      </TableRow>
                    )}
                    {filteredUnits.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">{unit.name}</TableCell>
                        <TableCell>{unit.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{unit.type}</Badge>
                        </TableCell>
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
                              open={isUnitDeleteAlertOpen && unitToDelete?.id === unit.id}
                              onOpenChange={(open) => {
                                if (!open) setUnitToDelete(null);
                                setIsUnitDeleteAlertOpen(open);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleUnitDeleteClick(unit)}
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
                                  <AlertDialogCancel disabled={isSubmittingUnit}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmUnitDelete} disabled={isSubmittingUnit}>
                                    {isSubmittingUnit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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