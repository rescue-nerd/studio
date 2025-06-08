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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { City as FirestoreCity, Country as FirestoreCountry, State as FirestoreState, Unit as FirestoreUnit } from "@/types/firestore";
import { Edit, Loader2, PlusCircle, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

interface Country extends FirestoreCountry {}
interface State extends FirestoreState {}
interface City extends FirestoreCity {}
interface Unit extends FirestoreUnit {}


const unitTypes: FirestoreUnit["type"][] = ["Weight", "Distance", "Volume", "Other"];

// Form data types exclude server-set fields
type CountryFormData = Omit<FirestoreCountry, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type StateFormData = Omit<FirestoreState, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type CityFormData = Omit<FirestoreCity, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
type UnitFormData = Omit<FirestoreUnit, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;


const defaultCountryFormData: CountryFormData = { name: "", code: "" };
const defaultStateFormData: StateFormData = { name: "", countryId: "" };
const defaultCityFormData: CityFormData = { name: "", stateId: "" };
const defaultUnitFormData: UnitFormData = { name: "", symbol: "", type: "Other" };

interface CountryResponse {
  success: boolean;
  error?: { message: string };
  data?: any;
}

const createCountryFn = async (data: { name: string; code: string }) => {
  try {
    const session = await supabase.auth.getSession();
    const { data: response, error } = await supabase.functions.invoke('create-country', {
      body: { name: data.name, code: data.code },
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`
      }
    })

    if (error) {
      throw new Error(error.message || 'Failed to create country')
    }

    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to create country')
    }

    return { success: true, data: response?.data }
  } catch (error) {
    console.error('Create country error:', error)
    throw error
  }
}

const updateCountryFn = async (data: { countryId: string; name: string; code: string }) => {
  try {
    const session = await supabase.auth.getSession();
    console.log('updateCountryFn payload:', data);
    console.log('updateCountryFn access token:', session.data.session?.access_token);
    const { data: response, error } = await supabase.functions.invoke('update-country', {
      body: { countryId: data.countryId, name: data.name, code: data.code },
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`
      }
    })

    if (error) {
      console.error('Edge function error object:', error);
      if (error.data && error.data.error && error.data.error.message) {
        throw new Error(error.data.error.message);
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Failed to update country');
      }
    }

    if (response && !response.success) {
      console.error('Edge function response error:', response.error);
      throw new Error(response.error?.message || 'Failed to update country')
    }

    return { success: true, data: response?.data }
  } catch (error) {
    console.error('Update country error:', error)
    throw error
  }
}

const deleteCountryFn = async (data: { id: string }) => {
  try {
    const session = await supabase.auth.getSession();
    const { data: response, error } = await supabase.functions.invoke('delete-country', {
      body: { id: data.id },
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`
      }
    })

    if (error) {
      throw new Error(error.message || 'Failed to delete country')
    }

    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to delete country')
    }

    return { success: true, data: response?.data }
  } catch (error) {
    console.error('Delete country error:', error)
    throw error
  }
}

// States
const createStateFn = async (data: StateFormData) => {
  try {
    const session = await supabase.auth.getSession();
    const { data: response, error } = await supabase.functions.invoke('create-state', {
      body: data,
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`
      }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to create state');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to create state');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Create state error:', error)
    throw error
  }
};

const updateStateFn = async (data: {stateId: string} & Partial<StateFormData>) => {
  try {
    const session = await supabase.auth.getSession();
    const { data: response, error } = await supabase.functions.invoke('update-state', {
      body: {
        id: data.stateId,
        name: data.name,
        countryId: data.countryId
      },
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`,
        'Content-Type': 'application/json',
        'x-client-info': 'supabase-js/2.0.0'
      }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to update state');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to update state');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Update state error:', error)
    throw error
  }
};

const deleteStateFn = async (data: {stateId: string}) => {
  try {
    const { data: response, error } = await supabase.functions.invoke('delete-state', {
      body: {
        id: data.stateId
      }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to delete state');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to delete state');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Delete state error:', error)
    throw error
  }
};

// Cities
const createCityFn = async (data: CityFormData) => {
  try {
    const { data: response, error } = await supabase.functions.invoke('create-city', {
      body: data
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to create city');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to create city');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Create city error:', error)
    throw error
  }
};

const updateCityFn = async (data: {cityId: string} & Partial<CityFormData>) => {
  try {
    const { data: response, error } = await supabase.functions.invoke('update-city', {
      body: {
        id: data.cityId,
        name: data.name,
        stateId: data.stateId
      }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to update city');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to update city');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Update city error:', error)
    throw error
  }
};

const deleteCityFn = async (data: {cityId: string}) => {
  try {
    const { data: response, error } = await supabase.functions.invoke('delete-city', {
      body: {
        id: data.cityId
      }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to delete city');
    }
    
    if (response && !response.success) {
      throw new Error(response.error?.message || 'Failed to delete city');
    }
    
    return { success: true, data: response?.data };
  } catch (error) {
    console.error('Delete city error:', error)
    throw error
  }
};

interface UnitResponse {
  success: boolean;
  error?: { message: string };
  data?: any;
}

const createUnitFn = async (data: { name: string; symbol: string; type: string }) => {
  console.log('Creating unit with data:', data);
  try {
    const { data: response, error } = await supabase.functions.invoke('create-unit', {
      body: { name: data.name, symbol: data.symbol, type: data.type }
    });

    console.log('Create unit response:', response);
    console.log('Create unit error:', error);

    if (error) {
      throw new Error(error.message || 'Failed to create unit');
    }

    return { success: true, data: response?.data };
  } catch (error: any) {
    console.error('Error in createUnitFn:', error);
    throw error;
  }
};

const updateUnitFn = async (data: { id: string; name: string; symbol: string; type: string }) => {
  console.log('Updating unit with data:', data);
  try {
    const { data: response, error } = await supabase.functions.invoke('update-unit', {
      body: { id: data.id, name: data.name, symbol: data.symbol, type: data.type }
    });

    console.log('Update unit response:', response);
    console.log('Update unit error:', error);

    if (error) {
      throw new Error(error.message || 'Failed to update unit');
    }

    return { success: true, data: response?.data };
  } catch (error: any) {
    console.error('Error in updateUnitFn:', error);
    throw error;
  }
};

const deleteUnitFn = async (data: { id: string }) => {
  console.log('Deleting unit with id:', data.id);
  try {
    const { data: response, error } = await supabase.functions.invoke('delete-unit', {
      body: { id: data.id }
    });

    console.log('Delete unit response:', response);
    console.log('Delete unit error:', error);

    if (error) {
      throw new Error(error.message || 'Failed to delete unit');
    }

    return { success: true, data: response?.data };
  } catch (error: any) {
    console.error('Error in deleteUnitFn:', error);
    throw error;
  }
};

export default function LocationsPage() {
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingStates, setIsLoadingStates] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isUnitDeleteOpen, setIsUnitDeleteOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitFormData, setUnitFormData] = useState<UnitFormData>(defaultUnitFormData);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [searchTermUnits, setSearchTermUnits] = useState("");
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchCountries = async () => {
    if (!authUser) return;
    setIsLoadingCountries(true);
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name');
      if (error) throw error;
      setCountries(data);
    } catch (error) {
      console.error("Error fetching countries: ", error);
      toast({ title: "Error", description: "Failed to fetch countries.", variant: "destructive" });
    } finally {
      setIsLoadingCountries(false);
    }
  };

  const fetchStates = async () => {
    if (!authUser) return;
    setIsLoadingStates(true);
    try {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .order('name');
      if (error) throw error;
      setStates(data);
    } catch (error) {
      console.error("Error fetching states: ", error);
      toast({ title: "Error", description: "Failed to fetch states.", variant: "destructive" });
    } finally {
      setIsLoadingStates(false);
    }
  };
  
  const fetchCities = async () => {
    if (!authUser) return;
    setIsLoadingCities(true);
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');
      if (error) throw error;
      setCities(data);
    } catch (error) {
      console.error("Error fetching cities: ", error);
      toast({ title: "Error", description: "Failed to fetch cities.", variant: "destructive" });
    } finally {
      setIsLoadingCities(false);
    }
  };

  const fetchUnits = async () => {
    if (!authUser) return;
    setIsLoadingUnits(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      if (error) throw error;
      setUnits(data);
    } catch (error) {
      console.error("Error fetching units: ", error);
      toast({ title: "Error", description: "Failed to fetch units.", variant: "destructive" });
    } finally {
      setIsLoadingUnits(false);
    }
  };

  useEffect(() => {
    if (authUser) {
        fetchCountries();
        fetchStates();
        fetchCities();
        fetchUnits();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // State for Countries Tab
  const [searchTermCountries, setSearchTermCountries] = useState("");
  const [isCountryFormOpen, setIsCountryFormOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [countryFormData, setCountryFormData] = useState<CountryFormData>(defaultCountryFormData);
  const [isCountryDeleteOpen, setIsCountryDeleteOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);

  // State for States Tab
  const [searchTermStates, setSearchTermStates] = useState("");
  const [isStateFormOpen, setIsStateFormOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [stateFormData, setStateFormData] = useState<StateFormData>(defaultStateFormData);
  const [isStateDeleteOpen, setIsStateDeleteOpen] = useState(false);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);

  // State for Cities Tab
  const [searchTermCities, setSearchTermCities] = useState("");
  const [isCityFormOpen, setIsCityFormOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityFormData, setCityFormData] = useState<CityFormData>(defaultCityFormData);
  const [isCityDeleteOpen, setIsCityDeleteOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  // --- Countries Handlers ---
  const handleCountryFormChange = (e: ChangeEvent<HTMLInputElement>) => setCountryFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const openAddCountryForm = () => { setEditingCountry(null); setCountryFormData(defaultCountryFormData); setIsCountryFormOpen(true); };
  const openEditCountryForm = (country: Country) => { 
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = country;
    setEditingCountry(country); 
    setCountryFormData(editableData); 
    setIsCountryFormOpen(true); 
  };
  const handleCountrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!countryFormData.name || !countryFormData.code) {
      toast({ title: "Validation Error", description: "Country Name and Code are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let result: {success: boolean; data: any};
      if (editingCountry) {
        result = await updateCountryFn({ countryId: editingCountry.id, name: countryFormData.name, code: countryFormData.code });
      } else {
        result = await createCountryFn(countryFormData);
      }
      
      if (result.success) {
        toast({ title: "Success", description: `Country ${editingCountry ? 'updated' : 'created'} successfully.` });
        fetchCountries();
        setIsCountryFormOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to save country.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving country: ", error);
      toast({ title: "Error", description: error.message || "Failed to save country.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteCountryClick = (country: Country) => { setCountryToDelete(country); setIsCountryDeleteOpen(true); };
  const confirmDeleteCountry = async () => {
    if (countryToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteCountryFn({ id: countryToDelete.id });
        
        if (result.success) {
          toast({ title: "Success", description: "Country deleted successfully." });
          fetchCountries();
        } else {
          toast({ title: "Error", description: "Failed to delete country.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting country:", error);
        toast({ title: "Error", description: error.message || "Failed to delete country.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsCountryDeleteOpen(false); 
        setCountryToDelete(null);
      }
    }
  };
  const filteredCountries = countries.filter(c => c.name.toLowerCase().includes(searchTermCountries.toLowerCase()) || c.code.toLowerCase().includes(searchTermCountries.toLowerCase()));

  // --- States Handlers ---
  const handleStateFormChange = (e: ChangeEvent<HTMLInputElement>) => setStateFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleStateCountryChange = (value: string) => setStateFormData(prev => ({ ...prev, countryId: value }));
  const openAddStateForm = () => { setEditingState(null); setStateFormData({...defaultStateFormData, countryId: countries[0]?.id || ""}); setIsStateFormOpen(true); };
  const openEditStateForm = (state: State) => { 
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = state;
    setEditingState(state); 
    setStateFormData(editableData); 
    setIsStateFormOpen(true); 
  };
  const handleStateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!stateFormData.name || !stateFormData.countryId) {
      toast({ title: "Validation Error", description: "State Name and Country are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let result: {success: boolean; data: any};
      if (editingState) {
        result = await updateStateFn({ stateId: editingState.id, ...stateFormData });
      } else {
        result = await createStateFn(stateFormData);
      }
      
       if (result.success) {
        toast({ title: "Success", description: `State ${editingState ? 'updated' : 'created'} successfully.` });
        fetchStates();
        setIsStateFormOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to save state.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving state: ", error);
      toast({ title: "Error", description: error.message || "Failed to save state.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteStateClick = (state: State) => { setStateToDelete(state); setIsStateDeleteOpen(true); };
  const confirmDeleteState = async () => {
    if (stateToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteStateFn({ stateId: stateToDelete.id });
        
        if (result.success) {
          toast({ title: "Success", description: "State deleted successfully." });
          fetchStates();
        } else {
          toast({ title: "Error", description: "Failed to delete state.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting state:", error);
        toast({ title: "Error", description: error.message || "Failed to delete state.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsStateDeleteOpen(false); setStateToDelete(null);
      }
    }
  };
  const getCountryName = (countryId: string) => countries.find(c => c.id === countryId)?.name || 'N/A';
  const filteredStates = states.filter(s => s.name.toLowerCase().includes(searchTermStates.toLowerCase()) || getCountryName(s.countryId).toLowerCase().includes(searchTermStates.toLowerCase()));


  // --- Cities Handlers ---
  const handleCityFormChange = (e: ChangeEvent<HTMLInputElement>) => setCityFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCityStateChange = (value: string) => setCityFormData(prev => ({ ...prev, stateId: value }));
  const openAddCityForm = () => { setEditingCity(null); setCityFormData({...defaultCityFormData, stateId: states[0]?.id || ""}); setIsCityFormOpen(true); };
  const openEditCityForm = (city: City) => { 
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = city;
    setEditingCity(city); 
    setCityFormData(editableData); 
    setIsCityFormOpen(true); 
  };
  const handleCitySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!cityFormData.name || !cityFormData.stateId) {
      toast({ title: "Validation Error", description: "City Name and State are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let result: {success: boolean; data: any};
      if (editingCity) {
        result = await updateCityFn({ cityId: editingCity.id, ...cityFormData });
      } else {
        result = await createCityFn(cityFormData);
      }
      
      if (result.success) {
        toast({ title: "Success", description: `City ${editingCity ? 'updated' : 'created'} successfully.` });
        fetchCities();
        setIsCityFormOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to save city.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving city: ", error);
      toast({ title: "Error", description: error.message || "Failed to save city.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteCityClick = (city: City) => { setCityToDelete(city); setIsCityDeleteOpen(true); };
  const confirmDeleteCity = async () => {
     if (cityToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteCityFn({ cityId: cityToDelete.id });
        
        if (result.success) {
          toast({ title: "Success", description: "City deleted successfully." });
          fetchCities();
        } else {
          toast({ title: "Error", description: "Failed to delete city.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting city:", error);
        toast({ title: "Error", description: error.message || "Failed to delete city.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsCityDeleteOpen(false); setCityToDelete(null);
      }
    }
  };
  const getStateName = (stateId: string) => states.find(s => s.id === stateId)?.name || 'N/A';
  const filteredCities = cities.filter(c => c.name.toLowerCase().includes(searchTermCities.toLowerCase()) || getStateName(c.stateId).toLowerCase().includes(searchTermCities.toLowerCase()));

  // --- Units Handlers ---
  const handleUnitFormChange = (e: ChangeEvent<HTMLInputElement>) => setUnitFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleUnitTypeChange = (value: FirestoreUnit["type"]) => setUnitFormData(prev => ({ ...prev, type: value }));
  const openAddUnitForm = () => { setEditingUnit(null); setUnitFormData(defaultUnitFormData); setIsUnitFormOpen(true); };
  const openEditUnitForm = (unit: Unit) => { 
    const { id, createdAt, createdBy, updatedAt, updatedBy, ...editableData } = unit;
    setEditingUnit(unit); 
    setUnitFormData(editableData); 
    setIsUnitFormOpen(true); 
  };
  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let result: {success: boolean; data: any};
      if (editingUnit) {
        result = await updateUnitFn({
          id: editingUnit.id,
          name: unitFormData.name,
          symbol: unitFormData.symbol,
          type: unitFormData.type
        });
      } else {
        result = await createUnitFn(unitFormData);
      }

      if (result.success) {
        toast({ title: "Success", description: `Unit ${editingUnit ? 'updated' : 'created'} successfully.` });
        fetchUnits();
        setIsUnitFormOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to save unit.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving unit: ", error);
      toast({ title: "Error", description: error.message || "Failed to save unit.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleUnitDelete = async () => {
    if (!unitToDelete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await deleteUnitFn({ id: unitToDelete.id });
      
      if (result.success) {
        toast({ title: "Success", description: "Unit deleted successfully." });
        fetchUnits();
      } else {
        toast({ title: "Error", description: "Failed to delete unit.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error deleting unit:", error);
      toast({ title: "Error", description: error.message || "Failed to delete unit.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsUnitDeleteOpen(false);
      setUnitToDelete(null);
    }
  };
  const filteredUnits = units.filter(u => u.name.toLowerCase().includes(searchTermUnits.toLowerCase()) || u.symbol.toLowerCase().includes(searchTermUnits.toLowerCase()));


  const renderLoading = (isLoadingFlag: boolean) => (
    isLoadingFlag ? (
      <TableRow>
        <TableCell colSpan={4} className="h-24 text-center">
          <div className="flex justify-center items-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading data...
          </div>
        </TableCell>
      </TableRow>
    ) : null
  );

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
      <div>
        <h1 className="text-3xl font-headline font-bold text-foreground">Locations & Unit Management</h1>
        <p className="text-muted-foreground">Manage countries, states, cities, and measurement units.</p>
      </div>

      <Tabs defaultValue="countries" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        {/* Countries Tab */}
        <TabsContent value="countries">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-lg">Countries</CardTitle>
                <Dialog open={isCountryFormOpen} onOpenChange={setIsCountryFormOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openAddCountryForm}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New Country
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCountry ? "Edit Country" : "Add New Country"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCountrySubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="countryName">Country Name</Label>
                        <Input id="countryName" name="name" value={countryFormData.name} onChange={handleCountryFormChange} required />
                      </div>
                      <div>
                        <Label htmlFor="countryCode">Country Code</Label>
                        <Input id="countryCode" name="code" value={countryFormData.code} onChange={handleCountryFormChange} required />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                          Save Country
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search countries..." className="pl-8" value={searchTermCountries} onChange={e => setSearchTermCountries(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCountries && renderLoading(isLoadingCountries)}
                  {!isLoadingCountries && filteredCountries.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No countries found.</TableCell></TableRow>}
                  {!isLoadingCountries && filteredCountries.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell>{country.name}</TableCell>
                      <TableCell>{country.code}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit Country" onClick={() => openEditCountryForm(country)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isCountryDeleteOpen && countryToDelete?.id === country.id} onOpenChange={(open) => { if(!open) setCountryToDelete(null); setIsCountryDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete Country" onClick={() => handleDeleteCountryClick(country)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Country?</AlertDialogTitle><AlertDialogDescription>This will delete "{countryToDelete?.name}". This action cannot be undone. Ensure no states are linked to this country.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsCountryDeleteOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteCountry} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* States Tab */}
        <TabsContent value="states">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-lg">States</CardTitle>
                <Dialog open={isStateFormOpen} onOpenChange={setIsStateFormOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openAddStateForm} disabled={countries.length === 0 || isLoadingCountries}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New State
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingState ? "Edit State" : "Add New State"}</DialogTitle>
                      <DialogDescription>
                        {editingState ? "Update the state's information below." : "Fill in the state's information below."}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleStateSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="stateName">State Name</Label>
                        <Input id="stateName" name="name" value={stateFormData.name} onChange={handleStateFormChange} required />
                      </div>
                      <div>
                        <Label htmlFor="stateCountry">Country</Label>
                        <Select value={stateFormData.countryId} onValueChange={handleStateCountryChange} required disabled={countries.length === 0 || isLoadingCountries}>
                          <SelectTrigger id="stateCountry"><SelectValue placeholder={isLoadingCountries ? "Loading countries..." : (countries.length === 0 ? "No countries" : "Select country")} /></SelectTrigger>
                          <SelectContent>
                            {countries.map(country => <SelectItem key={country.id} value={country.id}>{country.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting || countries.length === 0}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                          Save State
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search states by name or country..." className="pl-8" value={searchTermStates} onChange={e => setSearchTermStates(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingStates && renderLoading(isLoadingStates)}
                  {!isLoadingStates && filteredStates.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No states found.</TableCell></TableRow>}
                  {!isLoadingStates && filteredStates.map((state) => (
                    <TableRow key={state.id}>
                      <TableCell>{state.name}</TableCell>
                      <TableCell>{getCountryName(state.countryId)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit State" onClick={() => openEditStateForm(state)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isStateDeleteOpen && stateToDelete?.id === state.id} onOpenChange={(open) => { if(!open) setStateToDelete(null); setIsStateDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete State" onClick={() => handleDeleteStateClick(state)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete State?</AlertDialogTitle><AlertDialogDescription>This will delete "{stateToDelete?.name}". This action cannot be undone. Ensure no cities are linked to this state.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsStateDeleteOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteState} disabled={isSubmitting}>
                                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="cities">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-lg">Cities</CardTitle>
                <Dialog open={isCityFormOpen} onOpenChange={setIsCityFormOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openAddCityForm} disabled={states.length === 0 || isLoadingStates}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New City
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCity ? "Edit City" : "Add New City"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCitySubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="cityName">City Name</Label>
                        <Input id="cityName" name="name" value={cityFormData.name} onChange={handleCityFormChange} required />
                      </div>
                      <div>
                        <Label htmlFor="cityState">State</Label>
                        <Select value={cityFormData.stateId} onValueChange={handleCityStateChange} required disabled={states.length === 0 || isLoadingStates}>
                           <SelectTrigger id="cityState"><SelectValue placeholder={isLoadingStates ? "Loading states..." : (states.length === 0 ? "No states" : "Select state")} /></SelectTrigger>
                           <SelectContent>
                            {states.map(state => <SelectItem key={state.id} value={state.id}>{state.name} ({getCountryName(state.countryId)})</SelectItem>)}
                           </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting || states.length === 0}>
                           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                           Save City
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search cities by name or state..." className="pl-8" value={searchTermCities} onChange={e => setSearchTermCities(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>State (Country)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCities && renderLoading(isLoadingCities)}
                  {!isLoadingCities && filteredCities.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No cities found.</TableCell></TableRow>}
                  {!isLoadingCities && filteredCities.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell>{city.name}</TableCell>
                      <TableCell>{getStateName(city.stateId)} ({getCountryName(states.find(s => s.id === city.stateId)?.countryId || '')})</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit City" onClick={() => openEditCityForm(city)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isCityDeleteOpen && cityToDelete?.id === city.id} onOpenChange={(open) => { if(!open) setCityToDelete(null); setIsCityDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete City" onClick={() => handleDeleteCityClick(city)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete City?</AlertDialogTitle><AlertDialogDescription>This will delete "{cityToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsCityDeleteOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteCity} disabled={isSubmitting}>
                                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units">
          <Card className="shadow-md mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-lg">Units</CardTitle>
                <Dialog open={isUnitFormOpen} onOpenChange={setIsUnitFormOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openAddUnitForm}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingUnit ? "Edit Unit" : "Add New Unit"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUnitSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="unitName">Unit Name</Label>
                        <Input id="unitName" name="name" value={unitFormData.name} onChange={handleUnitFormChange} required />
                      </div>
                       <div>
                        <Label htmlFor="unitSymbol">Symbol</Label>
                        <Input id="unitSymbol" name="symbol" value={unitFormData.symbol} onChange={handleUnitFormChange} required />
                      </div>
                      <div>
                        <Label htmlFor="unitType">Unit Type</Label>
                        <Select value={unitFormData.type} onValueChange={handleUnitTypeChange} required>
                           <SelectTrigger id="unitType"><SelectValue placeholder="Select type" /></SelectTrigger>
                           <SelectContent>
                            {unitTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                           </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                           Save Unit
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search units by name or symbol..." className="pl-8" value={searchTermUnits} onChange={e => setSearchTermUnits(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
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
                  {isLoadingUnits && renderLoading(isLoadingUnits)}
                  {!isLoadingUnits && filteredUnits.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No units found.</TableCell></TableRow>}
                  {!isLoadingUnits && filteredUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>{unit.name}</TableCell>
                      <TableCell>{unit.symbol}</TableCell>
                      <TableCell>{unit.type}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit Unit" onClick={() => openEditUnitForm(unit)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                           <AlertDialog open={isUnitDeleteOpen && unitToDelete?.id === unit.id} onOpenChange={(open) => { if(!open) setUnitToDelete(null); setIsUnitDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete Unit" onClick={() => { setUnitToDelete(unit); setIsUnitDeleteOpen(true); }} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Unit?</AlertDialogTitle><AlertDialogDescription>This will delete "{unitToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsUnitDeleteOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleUnitDelete} disabled={isSubmitting}>
                                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}