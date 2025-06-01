
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Search, Edit, Trash2 } from "lucide-react";
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

// Interfaces for our data
interface Country {
  id: string;
  name: string;
  code: string;
}
interface State {
  id: string;
  name: string;
  countryId: string; // Link to Country
}
interface City {
  id: string;
  name: string;
  stateId: string; // Link to State
}
interface Unit {
  id: string;
  name: string;
  symbol: string;
  type: "Weight" | "Distance" | "Volume" | "Other";
}

// Mock initial data
const initialCountries: Country[] = [
  { id: "C001", name: "Nepal", code: "NP" },
  { id: "C002", name: "India", code: "IN" },
];
const initialStates: State[] = [
  { id: "S001", name: "Bagmati", countryId: "C001" },
  { id: "S002", name: "Gandaki", countryId: "C001" },
  { id: "S003", name: "Uttar Pradesh", countryId: "C002" },
];
const initialCities: City[] = [
  { id: "CT001", name: "Kathmandu", stateId: "S001" },
  { id: "CT002", name: "Pokhara", stateId: "S002" },
  { id: "CT003", name: "Lucknow", stateId: "S003" },
];
const initialUnits: Unit[] = [
  { id: "U001", name: "Kilogram", symbol: "kg", type: "Weight" },
  { id: "U002", name: "Kilometer", symbol: "km", type: "Distance" },
  { id: "U003", name: "Liter", symbol: "L", type: "Volume" },
];

const unitTypes: Unit["type"][] = ["Weight", "Distance", "Volume", "Other"];

// Default form data
const defaultCountryFormData: Omit<Country, 'id'> = { name: "", code: "" };
const defaultStateFormData: Omit<State, 'id'> = { name: "", countryId: "" };
const defaultCityFormData: Omit<City, 'id'> = { name: "", stateId: "" };
const defaultUnitFormData: Omit<Unit, 'id'> = { name: "", symbol: "", type: "Other" };

export default function LocationsPage() {
  // Main data states
  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [states, setStates] = useState<State[]>(initialStates);
  const [cities, setCities] = useState<City[]>(initialCities);
  const [units, setUnits] = useState<Unit[]>(initialUnits);

  // State for Countries Tab
  const [searchTermCountries, setSearchTermCountries] = useState("");
  const [isCountryFormOpen, setIsCountryFormOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [countryFormData, setCountryFormData] = useState<Omit<Country, 'id'>>(defaultCountryFormData);
  const [isCountryDeleteOpen, setIsCountryDeleteOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);

  // State for States Tab
  const [searchTermStates, setSearchTermStates] = useState("");
  const [isStateFormOpen, setIsStateFormOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [stateFormData, setStateFormData] = useState<Omit<State, 'id'>>(defaultStateFormData);
  const [isStateDeleteOpen, setIsStateDeleteOpen] = useState(false);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);

  // State for Cities Tab
  const [searchTermCities, setSearchTermCities] = useState("");
  const [isCityFormOpen, setIsCityFormOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityFormData, setCityFormData] = useState<Omit<City, 'id'>>(defaultCityFormData);
  const [isCityDeleteOpen, setIsCityDeleteOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  // State for Units Tab
  const [searchTermUnits, setSearchTermUnits] = useState("");
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitFormData, setUnitFormData] = useState<Omit<Unit, 'id'>>(defaultUnitFormData);
  const [isUnitDeleteOpen, setIsUnitDeleteOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  
  // Generic ID generator
  const generateId = (prefix: string, list: {id:string}[]) => `${prefix}${String(list.length + 1 + Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

  // --- Countries Handlers ---
  const handleCountryFormChange = (e: ChangeEvent<HTMLInputElement>) => setCountryFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const openAddCountryForm = () => { setEditingCountry(null); setCountryFormData(defaultCountryFormData); setIsCountryFormOpen(true); };
  const openEditCountryForm = (country: Country) => { setEditingCountry(country); setCountryFormData(country); setIsCountryFormOpen(true); };
  const handleCountrySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingCountry) {
      setCountries(countries.map(c => c.id === editingCountry.id ? { ...editingCountry, ...countryFormData } : c));
    } else {
      setCountries([...countries, { id: generateId("C", countries), ...countryFormData }]);
    }
    setIsCountryFormOpen(false);
  };
  const handleDeleteCountry = (country: Country) => { setCountryToDelete(country); setIsCountryDeleteOpen(true); };
  const confirmDeleteCountry = () => {
    if (countryToDelete) setCountries(countries.filter(c => c.id !== countryToDelete.id));
    setIsCountryDeleteOpen(false); setCountryToDelete(null);
  };
  const filteredCountries = countries.filter(c => c.name.toLowerCase().includes(searchTermCountries.toLowerCase()) || c.code.toLowerCase().includes(searchTermCountries.toLowerCase()));

  // --- States Handlers ---
  const handleStateFormChange = (e: ChangeEvent<HTMLInputElement>) => setStateFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleStateCountryChange = (value: string) => setStateFormData(prev => ({ ...prev, countryId: value }));
  const openAddStateForm = () => { setEditingState(null); setStateFormData(defaultStateFormData); setIsStateFormOpen(true); };
  const openEditStateForm = (state: State) => { setEditingState(state); setStateFormData(state); setIsStateFormOpen(true); };
  const handleStateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingState) {
      setStates(states.map(s => s.id === editingState.id ? { ...editingState, ...stateFormData } : s));
    } else {
      setStates([...states, { id: generateId("S", states), ...stateFormData }]);
    }
    setIsStateFormOpen(false);
  };
  const handleDeleteState = (state: State) => { setStateToDelete(state); setIsStateDeleteOpen(true); };
  const confirmDeleteState = () => {
    if (stateToDelete) setStates(states.filter(s => s.id !== stateToDelete.id));
    setIsStateDeleteOpen(false); setStateToDelete(null);
  };
  const filteredStates = states.filter(s => s.name.toLowerCase().includes(searchTermStates.toLowerCase()));


  // --- Cities Handlers ---
  const handleCityFormChange = (e: ChangeEvent<HTMLInputElement>) => setCityFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCityStateChange = (value: string) => setCityFormData(prev => ({ ...prev, stateId: value }));
  const openAddCityForm = () => { setEditingCity(null); setCityFormData(defaultCityFormData); setIsCityFormOpen(true); };
  const openEditCityForm = (city: City) => { setEditingCity(city); setCityFormData(city); setIsCityFormOpen(true); };
  const handleCitySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingCity) {
      setCities(cities.map(c => c.id === editingCity.id ? { ...editingCity, ...cityFormData } : c));
    } else {
      setCities([...cities, { id: generateId("CT", cities), ...cityFormData }]);
    }
    setIsCityFormOpen(false);
  };
  const handleDeleteCity = (city: City) => { setCityToDelete(city); setIsCityDeleteOpen(true); };
  const confirmDeleteCity = () => {
    if (cityToDelete) setCities(cities.filter(c => c.id !== cityToDelete.id));
    setIsCityDeleteOpen(false); setCityToDelete(null);
  };
  const filteredCities = cities.filter(c => c.name.toLowerCase().includes(searchTermCities.toLowerCase()));

  // --- Units Handlers ---
  const handleUnitFormChange = (e: ChangeEvent<HTMLInputElement>) => setUnitFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleUnitTypeChange = (value: Unit["type"]) => setUnitFormData(prev => ({ ...prev, type: value }));
  const openAddUnitForm = () => { setEditingUnit(null); setUnitFormData(defaultUnitFormData); setIsUnitFormOpen(true); };
  const openEditUnitForm = (unit: Unit) => { setEditingUnit(unit); setUnitFormData(unit); setIsUnitFormOpen(true); };
  const handleUnitSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      setUnits(units.map(u => u.id === editingUnit.id ? { ...editingUnit, ...unitFormData } : u));
    } else {
      setUnits([...units, { id: generateId("U", units), ...unitFormData }]);
    }
    setIsUnitFormOpen(false);
  };
  const handleDeleteUnit = (unit: Unit) => { setUnitToDelete(unit); setIsUnitDeleteOpen(true); };
  const confirmDeleteUnit = () => {
    if (unitToDelete) setUnits(units.filter(u => u.id !== unitToDelete.id));
    setIsUnitDeleteOpen(false); setUnitToDelete(null);
  };
  const filteredUnits = units.filter(u => u.name.toLowerCase().includes(searchTermUnits.toLowerCase()) || u.symbol.toLowerCase().includes(searchTermUnits.toLowerCase()));

  // Helper to get country name by ID
  const getCountryName = (countryId: string) => countries.find(c => c.id === countryId)?.name || 'N/A';
  // Helper to get state name by ID
  const getStateName = (stateId: string) => states.find(s => s.id === stateId)?.name || 'N/A';

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
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Country</Button>
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
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCountries.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell>{country.id}</TableCell>
                      <TableCell>{country.name}</TableCell>
                      <TableCell>{country.code}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit Country" onClick={() => openEditCountryForm(country)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isCountryDeleteOpen && countryToDelete?.id === country.id} onOpenChange={(open) => { if(!open) setCountryToDelete(null); setIsCountryDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete Country" onClick={() => handleDeleteCountry(country)}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Country?</AlertDialogTitle><AlertDialogDescription>This will delete "{countryToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setIsCountryDeleteOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCountry}>Delete</AlertDialogAction></AlertDialogFooter>
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
                    <Button variant="outline" size="sm" onClick={openAddStateForm}>
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
                        <Select value={stateFormData.countryId} onValueChange={handleStateCountryChange} required>
                          <SelectTrigger id="stateCountry"><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {countries.map(country => <SelectItem key={country.id} value={country.id}>{country.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save State</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search states..." className="pl-8" value={searchTermStates} onChange={e => setSearchTermStates(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStates.map((state) => (
                    <TableRow key={state.id}>
                      <TableCell>{state.id}</TableCell>
                      <TableCell>{state.name}</TableCell>
                      <TableCell>{getCountryName(state.countryId)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit State" onClick={() => openEditStateForm(state)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isStateDeleteOpen && stateToDelete?.id === state.id} onOpenChange={(open) => { if(!open) setStateToDelete(null); setIsStateDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete State" onClick={() => handleDeleteState(state)}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete State?</AlertDialogTitle><AlertDialogDescription>This will delete "{stateToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setIsStateDeleteOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteState}>Delete</AlertDialogAction></AlertDialogFooter>
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
                    <Button variant="outline" size="sm" onClick={openAddCityForm}>
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
                        <Select value={cityFormData.stateId} onValueChange={handleCityStateChange} required>
                           <SelectTrigger id="cityState"><SelectValue placeholder="Select state" /></SelectTrigger>
                           <SelectContent>
                            {states.map(state => <SelectItem key={state.id} value={state.id}>{state.name} ({getCountryName(state.countryId)})</SelectItem>)}
                           </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save City</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search cities..." className="pl-8" value={searchTermCities} onChange={e => setSearchTermCities(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCities.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell>{city.id}</TableCell>
                      <TableCell>{city.name}</TableCell>
                      <TableCell>{getStateName(city.stateId)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit City" onClick={() => openEditCityForm(city)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={isCityDeleteOpen && cityToDelete?.id === city.id} onOpenChange={(open) => { if(!open) setCityToDelete(null); setIsCityDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete City" onClick={() => handleDeleteCity(city)}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete City?</AlertDialogTitle><AlertDialogDescription>This will delete "{cityToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setIsCityDeleteOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCity}>Delete</AlertDialogAction></AlertDialogFooter>
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
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Unit</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search units..." className="pl-8" value={searchTermUnits} onChange={e => setSearchTermUnits(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>{unit.id}</TableCell>
                      <TableCell>{unit.name}</TableCell>
                      <TableCell>{unit.symbol}</TableCell>
                      <TableCell>{unit.type}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" aria-label="Edit Unit" onClick={() => openEditUnitForm(unit)}><Edit className="h-4 w-4" /></Button>
                           <AlertDialog open={isUnitDeleteOpen && unitToDelete?.id === unit.id} onOpenChange={(open) => { if(!open) setUnitToDelete(null); setIsUnitDeleteOpen(open);}}>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" aria-label="Delete Unit" onClick={() => handleDeleteUnit(unit)}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Unit?</AlertDialogTitle><AlertDialogDescription>This will delete "{unitToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setIsUnitDeleteOpen(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteUnit}>Delete</AlertDialogAction></AlertDialogFooter>
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


    