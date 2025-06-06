
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, functions } from "@/lib/firebase";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { Country as FirestoreCountry, State as FirestoreState, City as FirestoreCity, Unit as FirestoreUnit } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

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

// Countries
const createCountryFn = httpsCallable<CountryFormData, {success: boolean, id: string, message: string}>(functions, 'createCountry');
const updateCountryFn = httpsCallable<{countryId: string} & Partial<CountryFormData>, {success: boolean, id: string, message: string}>(functions, 'updateCountry');
const deleteCountryFn = httpsCallable<{countryId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteCountry');
// States
const createStateFn = httpsCallable<StateFormData, {success: boolean, id: string, message: string}>(functions, 'createState');
const updateStateFn = httpsCallable<{stateId: string} & Partial<StateFormData>, {success: boolean, id: string, message: string}>(functions, 'updateState');
const deleteStateFn = httpsCallable<{stateId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteState');
// Cities
const createCityFn = httpsCallable<CityFormData, {success: boolean, id: string, message: string}>(functions, 'createCity');
const updateCityFn = httpsCallable<{cityId: string} & Partial<CityFormData>, {success: boolean, id: string, message: string}>(functions, 'updateCity');
const deleteCityFn = httpsCallable<{cityId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteCity');
// Units
const createUnitFn = httpsCallable<UnitFormData, {success: boolean, id: string, message: string}>(functions, 'createUnit');
const updateUnitFn = httpsCallable<{unitId: string} & Partial<UnitFormData>, {success: boolean, id: string, message: string}>(functions, 'updateUnit');
const deleteUnitFn = httpsCallable<{unitId: string}, {success: boolean, id: string, message: string}>(functions, 'deleteUnit');


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

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  const fetchCountries = async () => {
    if (!authUser) return;
    setIsLoadingCountries(true);
    try {
      const q = query(collection(db, "countries"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setCountries(querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<FirestoreCountry, 'id'>, id: doc.id })));
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
      const q = query(collection(db, "states"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setStates(querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<FirestoreState, 'id'>, id: doc.id })));
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
      const q = query(collection(db, "cities"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setCities(querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<FirestoreCity, 'id'>, id: doc.id })));
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
      const q = query(collection(db, "units"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setUnits(querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<FirestoreUnit, 'id'>, id: doc.id })));
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

  // State for Units Tab
  const [searchTermUnits, setSearchTermUnits] = useState("");
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitFormData, setUnitFormData] = useState<UnitFormData>(defaultUnitFormData);
  const [isUnitDeleteOpen, setIsUnitDeleteOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

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
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingCountry) {
        result = await updateCountryFn({ countryId: editingCountry.id, ...countryFormData });
      } else {
        result = await createCountryFn(countryFormData);
      }
      if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchCountries();
        setIsCountryFormOpen(false);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
        const result = await deleteCountryFn({ countryId: countryToDelete.id });
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message });
          fetchCountries();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingState) {
        result = await updateStateFn({ stateId: editingState.id, ...stateFormData });
      } else {
        result = await createStateFn(stateFormData);
      }
       if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchStates();
        setIsStateFormOpen(false);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message });
          fetchStates();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingCity) {
        result = await updateCityFn({ cityId: editingCity.id, ...cityFormData });
      } else {
        result = await createCityFn(cityFormData);
      }
      if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchCities();
        setIsCityFormOpen(false);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message });
          fetchCities();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
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
  const handleUnitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!unitFormData.name || !unitFormData.symbol || !unitFormData.type) {
      toast({ title: "Validation Error", description: "Unit Name, Symbol, and Type are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let result: HttpsCallableResult<{success: boolean; id: string; message: string}>;
      if (editingUnit) {
        result = await updateUnitFn({ unitId: editingUnit.id, ...unitFormData });
      } else {
        result = await createUnitFn(unitFormData);
      }
      if (result.data.success) {
        toast({ title: "Success", description: result.data.message });
        fetchUnits();
        setIsUnitFormOpen(false);
      } else {
        toast({ title: "Error", description: result.data.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error saving unit: ", error);
      toast({ title: "Error", description: error.message || "Failed to save unit.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteUnitClick = (unit: Unit) => { setUnitToDelete(unit); setIsUnitDeleteOpen(true); };
  const confirmDeleteUnit = async () => {
    if (unitToDelete) {
      setIsSubmitting(true);
      try {
        const result = await deleteUnitFn({ unitId: unitToDelete.id });
        if (result.data.success) {
          toast({ title: "Success", description: result.data.message });
          fetchUnits();
        } else {
          toast({ title: "Error", description: result.data.message, variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error deleting unit:", error);
        toast({ title: "Error", description: error.message || "Failed to delete unit.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
        setIsUnitDeleteOpen(false); setUnitToDelete(null);
      }
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
        <h1 className="text-3xl font-headline font-bold text-foreground">Locations &amp; Unit Management</h1>
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
                              <Button variant="destructive" size="icon" aria-label="Delete Unit" onClick={() => handleDeleteUnitClick(unit)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Unit?</AlertDialogTitle><AlertDialogDescription>This will delete "{unitToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsUnitDeleteOpen(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteUnit} disabled={isSubmitting}>
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
