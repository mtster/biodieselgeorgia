import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, X, Upload, CheckCircle, Loader2, Users, MapPin, 
  AlertCircle, ChevronRight, Info, Sparkles, Check, Database, Compass, Home
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveCity, saveDistrict, saveDirection, saveWarehouse } from '../../services/lookupService';
import { saveUser } from '../../services/userService';
import { saveVendor, getVendors, generateUuid } from '../../services/vendorService';
import { City, District, Direction, User, Vendor, Warehouse } from '../../types';
import { isSupabaseConfigured, supabase } from '../../lib/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions?: Direction[];
  currentUser: User;
  onComplete: () => void;
}

type Step = 'upload' | 'scanning' | 'resolve' | 'check' | 'importing' | 'success';

interface ManagerFormState {
  name: string;
  email: string;
  personal_id: string;
  phone: string;
}

interface ExistingMatchingVendor {
  id?: string;
  trade_name: string;
  company_name: string;
  company_code: string;
  id_code: string;
}

// Normalized excel header map matching
const normalizationMapping: Record<string, string> = {
  // Trade Name
  "ობიექტისდასახელება": "trade_name",
  "ობიექტისდასახელება:": "trade_name",
  "ობიექტი": "trade_name",
  "tradename": "trade_name",
  
  // Legal Company Name
  "იურ.დასხ.": "company_name",
  "იურ.დასხ": "company_name",
  "იურიდიულიდასახელება": "company_name",
  "companyname": "company_name",

  // ID / Tax Code
  "ს/კ": "id_code",
  "საიდენტიფიკაციოკოდი": "id_code",
  "idcode": "id_code",

  // Address
  "ფაქტიურიმისამართი": "address",
  "მისამართი": "address",

  // District
  "რაიონი": "district",
  "უბანი": "district",

  // Direction
  "მიმართულება": "direction",

  // Bank Account
  "საბანკოანგარიში": "bank_account",
  "საბანკორეკვიზიტები": "bank_account",
  "ანგარიში": "bank_account",

  // Price
  "ფასი": "price_per_liter",
  "ლიტრისფასი": "price_per_liter",
  "ფასი(თეთრი)": "price_per_liter",

  // Email
  "მეილები": "email",
  "საკონტაქტომეილი": "email",
  "მეილი": "email",
  "email": "email",

  // Contacts
  "კონტაქტები": "contact_cell",
  "კონტაქტი": "contact_cell",
  "საკონტაქტოპირი": "contact_cell",
  "ბუღალტერისსაკონტაქტო": "accountant_cell",

  // City / Location
  "ქალაქი": "city",
  "მდებარეობა": "city",

  // Code
  "კოდი": "company_code",
  "ობიექტისკოდი": "company_code",

  // Warehouse
  "მინიჭებულისაწყობი": "warehouse",
  "საწყობი": "warehouse",

  // Sales Manager
  "გაყიდვებისმენეჯერი": "manager",
  "მენეჯერი": "manager",

  // Operations Manager / Operator
  "ოპერაციებისმენეჯერი": "operator",
  "ოპერატორი": "operator",

  // Comments / others
  "შენიშვნა/მთავარიკომენტარი": "comment_cell",
  "შენიშვნა": "comment_cell",
  "კომენტარი": "comment_cell",
  "ბოლოგატანა": "last_pickup_cell",
  "მოკითხვისდრო": "contact_time_cell",
  "კომენტარიმაისი": "may_comments_cell",
  "კომენტარიაპრილი": "april_comments_cell",
  "სტატუსი": "status"
};

const normalizeHeader = (h: any): string => {
  if (!h) return '';
  return h.toString()
    .replace(/["'\n\r]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
};

const transliterateName = (name: string): string => {
  const geoToLat: Record<string, string> = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i',
    'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's',
    'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts',
    'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
  };
  return name.split('').map(char => geoToLat[char] || char).join('').toLowerCase().replace(/\s+/g, '.');
};

export default function VendorImportModal({ 
  isOpen, onClose, warehouses, users, cities, districts, directions = [], currentUser, onComplete 
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local copies of lookups to survive in-session updates
  const [localCities, setLocalCities] = useState<City[]>(cities);
  const [localDistricts, setLocalDistricts] = useState<District[]>(districts);
  const [localDirections, setLocalDirections] = useState<Direction[]>(directions);
  const [localWarehouses, setLocalWarehouses] = useState<Warehouse[]>(warehouses);

  useEffect(() => { setLocalCities(cities); }, [cities]);
  useEffect(() => { setLocalDistricts(districts); }, [districts]);
  useEffect(() => { setLocalDirections(directions); }, [directions]);
  useEffect(() => { setLocalWarehouses(warehouses); }, [warehouses]);

  // Parsed sheet rows
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Pre-flight scan outcomes for missing lookups
  const [missingCities, setMissingCities] = useState<string[]>([]);
  const [missingDistricts, setMissingDistricts] = useState<{ city: string; district: string }[]>([]);
  const [missingDirections, setMissingDirections] = useState<string[]>([]);
  const [missingWarehouses, setMissingWarehouses] = useState<string[]>([]);
  const [missingManagers, setMissingManagers] = useState<string[]>([]);

  // Existing database vendor matches for re-import check phase
  const [matchingVendors, setMatchingVendors] = useState<ExistingMatchingVendor[]>([]);
  const [nonMatchingRows, setNonMatchingRows] = useState<any[]>([]);

  // Resolving maps: ExcelName -> DatabaseId/Name
  const [cityResolutionMap, setCityResolutionMap] = useState<Record<string, string>>({});
  const [districtResolutionMap, setDistrictResolutionMap] = useState<Record<string, string>>({});
  const [directionResolutionMap, setDirectionResolutionMap] = useState<Record<string, string>>({});
  const [warehouseResolutionMap, setWarehouseResolutionMap] = useState<Record<string, string>>({});
  const [managerResolutionMap, setManagerResolutionMap] = useState<Record<string, string>>({});

  // Manager interactive registration state
  const [currentManagerIdx, setCurrentManagerIdx] = useState<number>(0);
  const [managerForm, setManagerForm] = useState<ManagerFormState>({ name: '', email: '', personal_id: '', phone: '' });
  const [isCreatingManager, setIsCreatingManager] = useState<boolean>(false);

  // States for importing execution phase
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [importResults, setImportResults] = useState<{ vendors: number; contacts: number; comments: number }>({ vendors: 0, contacts: 0, comments: 0 });

  // Reset states upon reopening
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setFile(null);
      setErrorMsg(null);
      setRawRows([]);
      setMissingCities([]);
      setMissingDistricts([]);
      setMissingDirections([]);
      setMissingWarehouses([]);
      setMissingManagers([]);
      setMatchingVendors([]);
      setNonMatchingRows([]);
      setCityResolutionMap({});
      setDistrictResolutionMap({});
      setDirectionResolutionMap({});
      setWarehouseResolutionMap({});
      setManagerResolutionMap({});
      setCurrentManagerIdx(0);
      setProcessedRows(0);
      setTotalRows(0);
    }
  }, [isOpen]);

  // Handle individual manager pre-fill
  useEffect(() => {
    if (step === 'resolve' && missingManagers.length > 0 && currentManagerIdx < missingManagers.length) {
      const managerName = missingManagers[currentManagerIdx];
      const transliterated = transliterateName(managerName);
      setManagerForm({
        name: managerName,
        email: `${transliterated || 'manager' + Math.floor(Math.random() * 1000)}@biodiesel.ge`,
        personal_id: '3100' + Math.floor(1000000 + Math.random() * 9000000).toString(),
        phone: '59' + ['1', '2', '3', '4', '5', '7', '8', '9'][Math.floor(Math.random() * 8)] + Math.floor(100000 + Math.random() * 900000).toString()
      });
    }
  }, [step, missingManagers, currentManagerIdx]);

  if (!isOpen) return null;

  // File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMsg(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setErrorMsg(null);
    }
  };

  // Pre-Flight Check Scan Logic
  const startPreFlightScan = () => {
    if (!file) {
      setErrorMsg('გთხოვთ ატვირთოთ Excel ფაილი დასაწყებად.');
      return;
    }

    setStep('scanning');
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length <= 1) {
          throw new Error('ატვირთული Excel ფაილი ცარიელია ან არ გააჩნია სვეტების სათაურები.');
        }

        // Map headers
        const headers = data[0] as any[];
        const headerIndices: Record<string, number> = {};
        
        headers.forEach((h: any, idx: number) => {
          const norm = normalizeHeader(h);
          const mappedField = normalizationMapping[norm];
          if (mappedField) {
            headerIndices[mappedField] = idx;
          }
        });

        // Ensure trade name header was mapped
        if (headerIndices['trade_name'] === undefined) {
          throw new Error('ვერ მოხერხდა "ობიექტის დასახელება" სვეტის იდენტიფიცირება Excel ფაილში. გთხოვთ შეამოწმოთ სვეტები.');
        }

        // Parse rows
        const parsedRowsClean = data.slice(1).map((row: any, rIdx: number) => {
          const val = (field: string) => {
            const idx = headerIndices[field];
            if (idx === undefined || row[idx] === undefined || row[idx] === null) return '';
            return row[idx].toString().trim();
          };

          return {
            row_id: `row-${rIdx}`,
            trade_name: val('trade_name'),
            company_name: val('company_name') || val('trade_name'),
            id_code: val('id_code') || '204857392',
            address: val('address'),
            bank_account: val('bank_account'),
            price_per_liter: parseFloat(val('price_per_liter').replace(',', '.')) || 0.05,
            city: val('city') || 'თბილისი',
            district: val('district') || 'ვაკე',
            direction: val('direction'),
            warehouse: val('warehouse'),
            company_code: val('company_code'),
            status: val('status') || 'Active',
            contact_cell: val('contact_cell'),
            accountant_cell: val('accountant_cell'),
            comment_cell: val('comment_cell'),
            last_pickup_cell: val('last_pickup_cell'),
            contact_time_cell: val('contact_time_cell'),
            may_comments_cell: val('may_comments_cell'),
            april_comments_cell: val('april_comments_cell'),
            manager: val('manager'),
            operator: val('operator')
          };
        }).filter(r => r.trade_name !== '');

        setRawRows(parsedRowsClean);
        setErrorMsg(null);

        // Analyze missing lookup entries
        const sheetCities = Array.from(new Set(parsedRowsClean.map(r => r.city).filter(Boolean))) as string[];
        const sheetDistricts: { city: string; district: string }[] = [];
        parsedRowsClean.forEach(r => {
          if (r.city && r.district) {
            const exists = sheetDistricts.some(d => d.city === r.city && d.district === r.district);
            if (!exists) {
              sheetDistricts.push({ city: r.city, district: r.district });
            }
          }
        });
        const sheetDirections = Array.from(new Set(parsedRowsClean.map(r => r.direction).filter(Boolean))) as string[];
        const sheetWarehouses = Array.from(new Set(parsedRowsClean.map(r => r.warehouse).filter(Boolean))) as string[];
        const sheetManagers = Array.from(new Set(parsedRowsClean.map(r => r.manager).filter(Boolean))) as string[];

        // Map lowercases for matching checks
        const dbCitiesLower = localCities.map(c => c.name.trim().toLowerCase());
        const dbDistrictsLower = localDistricts.map(d => d.name.trim().toLowerCase());
        const dbDirectionsLower = localDirections.map(d => d.name.trim().toLowerCase());
        const dbWarehousesLower = localWarehouses.map(w => w.name.trim().toLowerCase());
        const dbUsersLower = users.map(u => u.name.trim().toLowerCase());

        const missingC = sheetCities.filter(sc => !dbCitiesLower.includes(sc.trim().toLowerCase()));
        const missingD = sheetDistricts.filter(sd => !dbDistrictsLower.includes(sd.district.trim().toLowerCase()));
        const missingDir = sheetDirections.filter(sdir => !dbDirectionsLower.includes(sdir.trim().toLowerCase()));
        const missingWh = sheetWarehouses.filter(sw => !dbWarehousesLower.includes(sw.trim().toLowerCase()));
        const missingM = sheetManagers.filter(sm => !dbUsersLower.includes(sm.trim().toLowerCase()));

        setMissingCities(missingC);
        setMissingDistricts(missingD);
        setMissingDirections(missingDir);
        setMissingWarehouses(missingWh);
        setMissingManagers(missingM);

        // Build default resolution mappings for existing lookups
        const initCityMap: Record<string, string> = {};
        localCities.forEach(c => {
          initCityMap[c.name.trim().toLowerCase()] = c.id;
          initCityMap[c.name.trim()] = c.id;
        });

        const initDistrictMap: Record<string, string> = {};
        localDistricts.forEach(d => {
          initDistrictMap[d.name.trim().toLowerCase()] = d.id;
          initDistrictMap[d.name.trim()] = d.id;
        });

        const initDirectionMap: Record<string, string> = {};
        localDirections.forEach(dir => {
          initDirectionMap[dir.name.trim().toLowerCase()] = dir.id;
          initDirectionMap[dir.name.trim()] = dir.id;
        });

        const initWarehouseMap: Record<string, string> = {};
        localWarehouses.forEach(w => {
          initWarehouseMap[w.name.trim().toLowerCase()] = w.id;
          initWarehouseMap[w.name.trim()] = w.id;
        });

        const initManagerMap: Record<string, string> = {};
        users.forEach(u => {
          initManagerMap[u.name.trim().toLowerCase()] = u.id;
          initManagerMap[u.name.trim()] = u.id;
        });

        setCityResolutionMap(initCityMap);
        setDistrictResolutionMap(initDistrictMap);
        setDirectionResolutionMap(initDirectionMap);
        setWarehouseResolutionMap(initWarehouseMap);
        setManagerResolutionMap(initManagerMap);

        // If lookups are missing, go to resolve step
        if (missingC.length > 0 || missingD.length > 0 || missingDir.length > 0 || missingWh.length > 0 || missingM.length > 0) {
          setStep('resolve');
        } else {
          // All lookups exist! Calculate matching records in DB and proceed to Check modal
          await prepareCheckStep(parsedRowsClean, initCityMap, initDistrictMap, initDirectionMap, initWarehouseMap, initManagerMap);
        }

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'დაფიქსირდა შეცდომა Excel ფაილის წაკითხვისას.');
        setStep('upload');
      }
    };

    reader.onerror = () => {
      setErrorMsg('ფაილის წაკითხვა ვერ მოხერხდა.');
      setStep('upload');
    };
    reader.readAsBinaryString(file);
  };

  // Prepare Check Step: Query existing database records to calculate duplicates/matches
  const prepareCheckStep = async (
    allRows: any[],
    cityMap: Record<string, string>,
    districtMap: Record<string, string>,
    directionMap: Record<string, string>,
    whMap: Record<string, string>,
    managerMap: Record<string, string>
  ) => {
    setProgressMsg('მოწმდება ბაზაში არსებული ჩანაწერები...');
    
    let dbVendors: ExistingMatchingVendor[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, id_code, company_name, trade_name, company_code')
          .eq('is_deleted', false)
          .range(0, 10000);
        if (!error && data) {
          dbVendors = data;
        }
      } catch (err) {
        console.warn('Failed to query existing vendors directly from Supabase', err);
      }
    }
    if (dbVendors.length === 0) {
      try {
        const allDb = await getVendors();
        dbVendors = allDb.map(v => ({
          id: v.id,
          id_code: v.id_code || '',
          company_name: v.company_name || v.trade_name || '',
          trade_name: v.trade_name || '',
          company_code: v.company_code || ''
        }));
      } catch (err) {
        console.warn('Failed to query existing vendors', err);
      }
    }

    const matches: ExistingMatchingVendor[] = [];
    const nonMatches: any[] = [];
    const seenBatchCodes = new Set<string>();

    allRows.forEach(row => {
      const codeStr = (row.company_code || '').toString().trim().toLowerCase();
      const idStr = (row.id_code || '').toString().trim();

      let matchedInDb: ExistingMatchingVendor | undefined = undefined;

      if (codeStr) {
        // Reliable matching: match strictly by company_code (კოდი in Excel)
        matchedInDb = dbVendors.find(v => (v.company_code || '').toString().trim().toLowerCase() === codeStr);
      } else if (idStr && idStr !== '204857392') {
        // Fallback matching: match by id_code if valid and non-generic
        matchedInDb = dbVendors.find(v => (v.id_code || '').toString().trim() === idStr);
      }

      const isDuplicateInBatch = !!(codeStr && seenBatchCodes.has(codeStr));

      if (matchedInDb || isDuplicateInBatch) {
        matches.push({
          id: matchedInDb?.id || `dup-${Math.random().toString(36).substring(2, 8)}`,
          trade_name: row.trade_name,
          company_name: row.company_name || matchedInDb?.company_name || '',
          company_code: row.company_code || matchedInDb?.company_code || '',
          id_code: row.id_code || matchedInDb?.id_code || ''
        });
      } else {
        nonMatches.push(row);
      }

      if (codeStr) {
        seenBatchCodes.add(codeStr);
      }
    });

    setMatchingVendors(matches);
    setNonMatchingRows(nonMatches);
    setCityResolutionMap(cityMap);
    setDistrictResolutionMap(districtMap);
    setDirectionResolutionMap(directionMap);
    setWarehouseResolutionMap(whMap);
    setManagerResolutionMap(managerMap);

    setStep('check');
  };

  // Interactive lookups auto-creation
  const handleResolveAndProceedList = async (resolveEntries: boolean) => {
    setStep('scanning');
    
    let resolvedCityIds = { ...cityResolutionMap };
    let resolvedDistrictIds = { ...districtResolutionMap };
    let resolvedDirectionIds = { ...directionResolutionMap };
    let resolvedWarehouseIds = { ...warehouseResolutionMap };

    if (resolveEntries) {
      setProgressMsg('იქმნება ახალი დამხმარე ჩანაწერები (created_by: "import")...');
      try {
        // Cities
        const newCitiesList: City[] = [];
        for (const cityName of missingCities) {
          const savedC = await saveCity({
            id: '',
            name: cityName,
            created_by: 'import',
            is_deleted: false
          }, 'import');
          resolvedCityIds[cityName.trim().toLowerCase()] = savedC.id;
          resolvedCityIds[cityName.trim()] = savedC.id;
          newCitiesList.push(savedC);
        }
        if (newCitiesList.length > 0) {
          setLocalCities(prev => [...prev, ...newCitiesList]);
        }

        // Districts
        const newDistrictsList: District[] = [];
        for (const distInfo of missingDistricts) {
          const parentCityLower = distInfo.city.trim().toLowerCase();
          const cityId = resolvedCityIds[parentCityLower] || resolvedCityIds[distInfo.city] || '';
          
          if (cityId) {
            const savedD = await saveDistrict({
              id: '',
              city_id: cityId,
              name: distInfo.district,
              created_by: 'import'
            }, 'import');
            resolvedDistrictIds[distInfo.district.trim().toLowerCase()] = savedD.id;
            resolvedDistrictIds[distInfo.district.trim()] = savedD.id;
            newDistrictsList.push(savedD);
          }
        }
        if (newDistrictsList.length > 0) {
          setLocalDistricts(prev => [...prev, ...newDistrictsList]);
        }

        // Directions
        const newDirectionsList: Direction[] = [];
        for (const dirName of missingDirections) {
          const savedDir = await saveDirection({
            id: '',
            name: dirName,
            created_by: 'import',
            is_deleted: false
          }, 'import');
          resolvedDirectionIds[dirName.trim().toLowerCase()] = savedDir.id;
          resolvedDirectionIds[dirName.trim()] = savedDir.id;
          newDirectionsList.push(savedDir);
        }
        if (newDirectionsList.length > 0) {
          setLocalDirections(prev => [...prev, ...newDirectionsList]);
        }

        // Warehouses
        const newWarehousesList: Warehouse[] = [];
        for (const whName of missingWarehouses) {
          const savedWh = await saveWarehouse({
            id: '',
            name: whName,
            created_by: 'import',
            is_deleted: false
          }, 'import');
          resolvedWarehouseIds[whName.trim().toLowerCase()] = savedWh.id;
          resolvedWarehouseIds[whName.trim()] = savedWh.id;
          newWarehousesList.push(savedWh);
        }
        if (newWarehousesList.length > 0) {
          setLocalWarehouses(prev => [...prev, ...newWarehousesList]);
        }

      } catch (e) {
        console.error('Error auto-creating lookups:', e);
      }
    }

    setMissingCities([]);
    setMissingDistricts([]);
    setMissingDirections([]);
    setMissingWarehouses([]);

    setCurrentManagerIdx(0);
    
    if (missingManagers.length === 0) {
      await prepareCheckStep(rawRows, resolvedCityIds, resolvedDistrictIds, resolvedDirectionIds, resolvedWarehouseIds, managerResolutionMap);
    } else {
      setCityResolutionMap(resolvedCityIds);
      setDistrictResolutionMap(resolvedDistrictIds);
      setDirectionResolutionMap(resolvedDirectionIds);
      setWarehouseResolutionMap(resolvedWarehouseIds);
      setStep('resolve');
    }
  };

  // Interactive User/Manager Creation
  const handleCreateManager = async () => {
    if (!managerForm.name.trim() || !managerForm.email.trim()) {
      alert('მიუთითეთ სახელი და ელ.ფოსტა');
      return;
    }
    setIsCreatingManager(true);
    try {
      const userPayload: User = {
        id: '',
        email: managerForm.email,
        password: 'Georgia2026!',
        name: managerForm.name,
        personal_id: managerForm.personal_id,
        phone: managerForm.phone,
        role: 'purchasing_head',
        permissions: {},
        created_at: new Date().toISOString()
      };

      const createdUser = await saveUser(userPayload, 'import');
      
      setManagerResolutionMap(prev => ({
        ...prev,
        [managerForm.name.trim().toLowerCase()]: createdUser.id,
        [managerForm.name.trim()]: createdUser.id
      }));

      setCurrentManagerIdx(prev => prev + 1);
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ მენეჯერის შექმნა ვერ მოხერხდა: ${e.message}`);
    } finally {
      setIsCreatingManager(false);
    }
  };

  const handleSkipManager = () => {
    const skippedName = missingManagers[currentManagerIdx];
    setManagerResolutionMap(prev => ({
      ...prev,
      [skippedName.trim().toLowerCase()]: '',
      [skippedName.trim()]: ''
    }));
    setCurrentManagerIdx(prev => prev + 1);
  };

  const handleSkipAllManagersAndProceed = async () => {
    const finalManagersMap = { ...managerResolutionMap };
    missingManagers.slice(currentManagerIdx).forEach(mgr => {
      finalManagersMap[mgr.trim().toLowerCase()] = '';
      finalManagersMap[mgr.trim()] = '';
    });
    setManagerResolutionMap(finalManagersMap);
    await prepareCheckStep(rawRows, cityResolutionMap, districtResolutionMap, directionResolutionMap, warehouseResolutionMap, finalManagersMap);
  };

  const handleAcceptManagersAndProceedToCheck = async () => {
    await prepareCheckStep(rawRows, cityResolutionMap, districtResolutionMap, directionResolutionMap, warehouseResolutionMap, managerResolutionMap);
  };

  // Execute Import: Imports new (non-duplicate) rows with created_by="import"
  const startImportingExecution = async () => {
    const rowsToImport = nonMatchingRows;
    if (rowsToImport.length === 0) {
      return;
    }
    
    setStep('importing');
    setTotalRows(rowsToImport.length);
    setProcessedRows(0);
    setProgressMsg('მზადდება მონაცემები იმპორტისთვის (created_by = "import")...');

    let importCount = 0;
    let contactsCount = 0;
    let commentsCount = 0;

    const batchSize = 50;

    try {
      for (let i = 0; i < rowsToImport.length; i += batchSize) {
        const batchRows = rowsToImport.slice(i, i + batchSize);
        setProgressMsg(`პროცესინგი: იგზავნება ${i + 1}-დან ${Math.min(i + batchSize, rowsToImport.length)}-მდე ჩანაწერი Gemini API-ში...`);

        const payloadRows = batchRows.map(r => ({
          row_id: r.row_id,
          contact_cell: r.contact_cell || '',
          accountant_cell: r.accountant_cell || '',
          comment_cell: r.comment_cell || '',
          last_pickup_cell: r.last_pickup_cell || '',
          contact_time_cell: r.contact_time_cell || '',
          may_comments_cell: r.may_comments_cell || '',
          april_comments_cell: r.april_comments_cell || ''
        }));

        let geminiParsedList: any[] = [];
        
        // Try Express API first, fallback to Supabase Edge Function
        try {
          const res = await fetch('/api/import-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: payloadRows })
          });
          if (res.ok) {
            const resData = await res.json();
            geminiParsedList = resData.data || [];
          } else {
            throw new Error(`Express API status ${res.status}`);
          }
        } catch (expressErr) {
          console.warn('Falling back to Supabase Edge Function for Gemini parse', expressErr);
          const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
          const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

          const edgeRes = await fetch(`${supabaseUrl}/functions/v1/import-excel`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ rows: payloadRows })
          });

          if (edgeRes.ok) {
            const resData = await edgeRes.json();
            geminiParsedList = resData.data || [];
          } else {
            console.warn('Edge function failed, continuing with basic extraction');
          }
        }

        const aiMap: Record<string, any> = {};
        geminiParsedList.forEach(item => {
          if (item.row_id) {
            aiMap[item.row_id] = item;
          }
        });

        setProgressMsg(`ბაზაში იწერება დამუშავებული ${batchRows.length} მიმწოდებელი...`);

        await Promise.all(batchRows.map(async (row) => {
          const aiExtract = aiMap[row.row_id] || { contacts: [], comments: [] };

          const mappedCityId = cityResolutionMap[row.city.trim().toLowerCase()] || cityResolutionMap[row.city.trim()] || '';
          const mappedCityName = localCities.find(c => c.id === mappedCityId)?.name || row.city || 'თბილისი';

          const mappedDistrictId = districtResolutionMap[row.district.trim().toLowerCase()] || districtResolutionMap[row.district.trim()] || '';
          const mappedDistrictName = localDistricts.find(d => d.id === mappedDistrictId)?.name || row.district || 'ვაკე';

          const mappedDirectionId = directionResolutionMap[(row.direction || '').trim().toLowerCase()] || directionResolutionMap[(row.direction || '').trim()] || null;
          
          const mappedWarehouseId = warehouseResolutionMap[(row.warehouse || '').trim().toLowerCase()] || warehouseResolutionMap[(row.warehouse || '').trim()] || (localWarehouses[0]?.id || '');

          const mappedManagerId = managerResolutionMap[(row.manager || '').trim().toLowerCase()] || managerResolutionMap[(row.manager || '').trim()] || currentUser.id;
          
          const mappedOperatorId = managerResolutionMap[(row.operator || '').trim().toLowerCase()] || managerResolutionMap[(row.operator || '').trim()] || currentUser.id;

          const contactsList = (aiExtract.contacts || []).map((c: any, cIdx: number) => ({
            id: generateUuid(),
            name: c.name || 'კონტაქტი',
            phone: c.phone || '',
            position: c.position || 'other',
            note: c.note || '',
            is_default: c.is_default !== undefined ? c.is_default : (cIdx === 0),
            sort_order: cIdx + 1,
            created_by: 'import',
            is_deleted: false
          }));

          const commentsList = (aiExtract.comments || []).map((cm: any, cmIdx: number) => ({
            id: generateUuid(),
            comment: cm.comment || 'კომენტარი',
            date: cm.date || new Date().toISOString().split('T')[0],
            user_name: cm.user_name || 'System Import'
          }));

          const newVendorId = generateUuid();
          const cleanCode = (row.company_code || '').toString().trim();
          const rawIdCode = (row.id_code || '').toString().trim();
          const uniqueCompCode = cleanCode || (rawIdCode && rawIdCode !== '204857392' ? rawIdCode : `CC-${newVendorId.slice(-8)}`);

          const finalVendor: Vendor = {
            id: newVendorId,
            id_code: row.id_code || '204857392',
            company_name: row.company_name || row.trade_name,
            trade_name: row.trade_name,
            company_code: uniqueCompCode,
            bank_account: row.bank_account || 'GE00TB0000000000000000',
            city: mappedCityName,
            district: mappedDistrictName,
            address: row.address || 'Imported Address',
            price_per_liter: row.price_per_liter || 0.05,
            warehouse_id: mappedWarehouseId,
            manager_id: mappedManagerId,
            operator_id: mappedOperatorId,
            direction_id: mappedDirectionId,
            working_hours: '09:00 - 18:00',
            status: 'Active',
            barrels_amount: 0,
            is_active: true,
            is_deleted: false,
            created_by: 'import',
            email: row.email || '',
            contacts: contactsList,
            comments: commentsList,
            created_at: new Date().toISOString()
          };

          try {
            await saveVendor(finalVendor, 'import');
            importCount++;
            contactsCount += contactsList.length;
            commentsCount += commentsList.length;
          } catch (rowErr) {
            console.warn('Individual vendor save warning during import:', row.company_code || row.trade_name, rowErr);
          }
        }));

        setProcessedRows(prev => Math.min(prev + batchRows.length, rowsToImport.length));
      }

      setImportResults({ vendors: importCount, contacts: contactsCount, comments: commentsCount });
      setStep('success');
      onComplete();

    } catch (e: any) {
      console.error('Core import process exception:', e);
      setErrorMsg(e.message || 'იმპორტის პროცესში მოხდა ტექნიკური შეცდომა.');
      setStep('upload');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* HEADER AREA */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-shrink-0">
          <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-700" size={18} />
            მონაცემების იმპორტი ექსელიდან
          </h3>
          <button 
            onClick={onClose} 
            disabled={step === 'scanning' || step === 'importing'}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* WIZARD SCREENS CONTAINER */}
        <div className="flex-1 overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 text-xs animate-in slide-in-from-top-2 duration-200 mb-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black">შეცდომა:</strong>
                <p className="font-medium mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* SCREEN 1: FILE UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-emerald-50/10 cursor-pointer transition-all animate-in fade-in duration-200"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden" 
                />
                
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Upload size={22} />
                </div>

                <div className="text-center font-sans">
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-xs font-black text-gray-800">{file.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{(file.size / 1024).toFixed(1)} KB • დააჭირეთ შესაცვლელად</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-black text-gray-700">ჩააგდეთ Excel ფაილი აქ ან დააჭირეთ ასარჩევად</p>
                      <p className="text-[10px] text-gray-400">ფაილის ტიპი: .xlsx, .xls</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end select-none font-sans flex-shrink-0 pt-2 border-t border-gray-100">
                <button 
                  onClick={startPreFlightScan}
                  disabled={!file}
                  className="px-6 py-2 bg-emerald-800 hover:bg-emerald-950 disabled:bg-gray-100 disabled:text-gray-400 active:bg-emerald-900 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer"
                >
                  შემოწმება
                  <ChevronRight size={14} className="mt-0.5" />
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: SCANNING PROGRESS OVERLAY */}
          {step === 'scanning' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-200">
              <Loader2 className="animate-spin text-emerald-700" size={38} />
              <div className="space-y-1.5 font-sans">
                <h4 className="font-black text-sm text-gray-800">მიმდინარეობს შემოწმება...</h4>
                <p className="text-xs text-gray-500 max-w-sm">{progressMsg || 'ვეძებთ მონაცემთა ბაზაში არსებულ და დამხმარე ჩანაწერებს...'}</p>
              </div>
            </div>
          )}

          {/* SCREEN 3: RESOLVE MISSING ENTITIES WIZARD STEP */}
          {step === 'resolve' && (
            <div className="space-y-5 animate-in fade-in duration-250">
              
              {/* STAGE A: Cities, Districts, Directions, Warehouses Resolve Card */}
              {(missingCities.length > 0 || missingDistricts.length > 0 || missingDirections.length > 0 || missingWarehouses.length > 0) ? (
                <div className="border border-amber-250 bg-amber-50 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-amber-800 shrink-0 mt-0.5 animate-bounce" size={18} />
                    <div className="font-sans">
                      <h4 className="font-extrabold text-xs text-amber-950">დამხმარე ჩანაწერების სინქრონიზაცია</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">Excel-ში აღმოჩნდა ლოკაციები ან საწყობები, რომლებიც არ არსებობს საწყის მონაცემებში. გსურთ მათი ავტომატურად დამატება ბაზაში (created_by: "import")?</p>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto bg-white/75 rounded-xl p-3 border border-amber-100 space-y-2 text-[11px] font-sans">
                    {missingCities.map(c => (
                      <div key={c} className="flex items-center gap-1.5 text-amber-950 font-bold">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        ქალაქი: <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{c}</strong>
                      </div>
                    ))}
                    {missingDistricts.map(d => (
                      <div key={`${d.city}-${d.district}`} className="flex items-center gap-1.5 text-amber-950">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        უბანი: <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{d.city} &gt; {d.district}</strong>
                      </div>
                    ))}
                    {missingDirections.map(dir => (
                      <div key={dir} className="flex items-center gap-1.5 text-amber-950">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        მიმართულება: <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{dir}</strong>
                      </div>
                    ))}
                    {missingWarehouses.map(wh => (
                      <div key={wh} className="flex items-center gap-1.5 text-amber-950">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        საწყობი: <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{wh}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 select-none pt-1">
                    <button 
                      type="button"
                      onClick={() => handleResolveAndProceedList(false)}
                      className="px-4 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-950 rounded-xl text-[11.5px] font-bold"
                    >
                      ლინკის გარეშე იმპორტი
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleResolveAndProceedList(true)}
                      className="px-5 py-1.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white rounded-xl text-[11.5px] font-black transition"
                    >
                      ავტო-შექმნა და გაგრძელება
                    </button>
                  </div>
                </div>
              ) : null}

              {/* STAGE B: Managers creation */}
              {missingCities.length === 0 && missingDistricts.length === 0 && missingDirections.length === 0 && missingWarehouses.length === 0 && missingManagers.length > 0 && currentManagerIdx < missingManagers.length ? (
                <div className="border border-blue-200 bg-blue-50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-start gap-3">
                    <Users className="text-blue-800 shrink-0 mt-0.5" size={18} />
                    <div className="font-sans">
                      <h4 className="font-extrabold text-xs text-blue-950">
                        მენეჯერის დამატება — [{currentManagerIdx + 1} / {missingManagers.length}]
                      </h4>
                      <p className="text-[11px] text-blue-800 mt-0.5">
                        შემოწმებისას აღმოჩნდა მენეჯერი <strong className="text-blue-950 underline">{missingManagers[currentManagerIdx]}</strong>, რომლის ანგარიშიც არ ირიცხება ბაზაში. გთხოვთ შექმნათ მომხმარებლის პროფილი:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 bg-white/75 p-4 rounded-xl border border-blue-100">
                    <div>
                      <label className="block text-[10.5px] font-bold text-blue-900 mb-1">სახელი</label>
                      <input 
                        type="text" 
                        value={managerForm.name} 
                        onChange={e => setManagerForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-blue-900 mb-1">ელ.ფოსტა</label>
                      <input 
                        type="email" 
                        value={managerForm.email} 
                        onChange={e => setManagerForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-blue-900 mb-1">პირადი ID</label>
                      <input 
                        type="text" 
                        value={managerForm.personal_id} 
                        onChange={e => setManagerForm(prev => ({ ...prev, personal_id: e.target.value }))}
                        maxLength={11}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-blue-900 mb-1">ტელეფონი</label>
                      <input 
                        type="text" 
                        value={managerForm.phone} 
                        onChange={e => setManagerForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:outline-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 select-none font-sans">
                    <button 
                      type="button"
                      onClick={handleSkipManager}
                      className="px-4 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      ამ მენეჯერის გამოტოვება
                    </button>
                    
                    <div className="flex gap-2.5">
                      <button 
                        type="button"
                        onClick={handleSkipAllManagersAndProceed}
                        className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        ყველას გამოტოვება ({missingManagers.length - currentManagerIdx})
                      </button>
                      <button 
                        type="button"
                        onClick={handleCreateManager}
                        disabled={isCreatingManager}
                        className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer"
                      >
                        {isCreatingManager ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                        პროფილის შექმნა და გაგრძელება
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Bottom trigger fallback when managers list exhausts */}
              {missingCities.length === 0 && missingDistricts.length === 0 && missingDirections.length === 0 && missingWarehouses.length === 0 && (missingManagers.length === 0 || currentManagerIdx >= missingManagers.length) && (
                <div className="text-center py-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={22} className="animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-black text-sm text-gray-800">დამხმარე ჩანაწერები შემოწმებულია</h5>
                    <p className="text-xs text-gray-500">ყველა საჭირო დამხმარე ჩანაწერი მზადაა.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAcceptManagersAndProceedToCheck}
                    className="px-6 py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-black rounded-xl text-xs transition"
                  >
                    შემოწმების დასრულება
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SCREEN 4: PRE-FLIGHT CHECK RESULTS & DUPLICATE DISPLAY MODAL */}
          {step === 'check' && (
            <div className="space-y-4.5 animate-in fade-in duration-200 font-sans">
              {/* Notice Banner */}
              {nonMatchingRows.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="text-amber-700 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-black text-xs text-amber-950 uppercase tracking-wider">შემოწმების შედეგი</h4>
                    <p className="text-xs font-bold text-amber-900 mt-1">
                      ბაზაში უკვე არსებობს ეს ჩანაწერები.
                    </p>
                  </div>
                </div>
              ) : matchingVendors.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                  <CheckCircle className="text-emerald-700 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wider">შემოწმების შედეგი</h4>
                    <p className="text-xs font-bold text-emerald-800 mt-1">
                      ეს ჩანაწერები უკვე არსებობს ბაზაში და განმეორებითად არ შეიქმნება.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                  <CheckCircle className="text-emerald-700 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wider">შემოწმების შედეგი</h4>
                    <p className="text-xs font-bold text-emerald-800 mt-1">
                      დამხმარე ჩანაწერები არსებობს ბაზაში და არ საჭიროებს შექმნას.
                    </p>
                  </div>
                </div>
              )}

              {/* Matching/Duplicate Records Summary */}
              {matchingVendors.length > 0 ? (
                <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="text-slate-600" size={16} />
                      <span className="font-black text-xs text-slate-800">
                        {nonMatchingRows.length === 0 
                          ? `სულ ${rawRows.length} ჩანაწერიდან ყველა (${matchingVendors.length}) უკვე არსებობს ბაზაში`
                          : `სულ ${rawRows.length} ჩანაწერიდან ${matchingVendors.length} უკვე არსებობს ბაზაში`
                        }
                      </span>
                    </div>
                    <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                      {matchingVendors.length} დუბლიკატი
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                    {nonMatchingRows.length === 0 
                      ? 'ბაზაში უკვე არსებობს ეს ჩანაწერები.'
                      : `ეს ჩანაწერები უკვე არსებობს ბაზაში და განმეორებითად არ შეიქმნება. (${nonMatchingRows.length} ახალი ჩანაწერი დაემატება)`
                    }
                  </p>

                  {/* List of matching existing records */}
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-[11px]">
                    <div className="bg-slate-100 font-bold text-slate-600 px-3 py-1.5 grid grid-cols-3 sticky top-0">
                      <span>ობიექტის დასახელება</span>
                      <span>იურიდიული სახელი</span>
                      <span>ს/კ / კოდი</span>
                    </div>
                    {matchingVendors.map((mv, idx) => (
                      <div key={mv.id || idx} className="px-3 py-1.5 grid grid-cols-3 hover:bg-slate-50">
                        <span className="font-bold text-slate-900 truncate" title={mv.trade_name}>{mv.trade_name}</span>
                        <span className="text-slate-600 truncate" title={mv.company_name}>{mv.company_name}</span>
                        <span className="font-mono text-slate-500">{mv.id_code || mv.company_code || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-blue-100 bg-blue-50/70 rounded-2xl p-4 text-center space-y-1 text-blue-900">
                  <p className="text-xs font-bold">
                    ბაზაში მატჩინგი არ მოიძებნა. სულ {rawRows.length} ახალი ჩანაწერი შეიქმნება.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  უკან დაბრუნება
                </button>

                <button 
                  type="button"
                  onClick={startImportingExecution}
                  disabled={nonMatchingRows.length === 0}
                  className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-950 active:bg-emerald-900 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                >
                  იმპორტის დაწყება
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 5: PROGRESS BAR LOOPS OF GEMINI EXTRACTION */}
          {step === 'importing' && (
            <div className="py-8 space-y-5 animate-in fade-in duration-200 font-sans">
              <div className="flex items-center gap-2.5 justify-center">
                <Loader2 className="animate-spin text-emerald-700" size={24} />
                <h4 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wider">
                  მონაცემების იმპორტი (created_by: "import")...
                </h4>
              </div>

              <div className="space-y-2">
                <div className="bg-slate-100 rounded-full overflow-hidden h-4 w-full border border-gray-100 p-0.5">
                  <div 
                    className="bg-emerald-700 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2 font-mono text-[9px] text-white font-black"
                    style={{ width: `${totalRows > 0 ? (processedRows / totalRows) * 100 : 0}%` }}
                  >
                    {totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0}%
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold">
                  <span>დამუშავდა: {processedRows} რიგი</span>
                  <span>სულ ასატვირთი: {totalRows} რიგი</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-[11px] leading-relaxed text-gray-600 block max-h-32 overflow-y-auto">
                <div className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                  <p>{progressMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 6: SUCCESS REPORT SUMMARY */}
          {step === 'success' && (
            <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-200 font-sans">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-black text-sm text-gray-800">იმპორტი წარმატებით დასრულდა!</h3>
                <p className="text-xs text-gray-500">მონაცემები სრულად დამუშავდა და გადაიწერა ძირითად მონაცემთა ბაზაში (created_by: "import").</p>
              </div>

              <div className="max-w-xs mx-auto grid grid-cols-3 gap-2.5 bg-slate-50 border border-gray-100 rounded-xl p-3.5 text-center">
                <div className="p-1">
                  <span className="block text-xs text-gray-400 font-bold">ობიექტი</span>
                  <strong className="block text-sm text-gray-800 font-black">{importResults.vendors}</strong>
                </div>
                <div className="p-1 border-x border-gray-150">
                  <span className="block text-xs text-gray-400 font-bold">კონტაქტი</span>
                  <strong className="block text-sm text-emerald-800 font-black">+{importResults.contacts}</strong>
                </div>
                <div className="p-1">
                  <span className="block text-xs text-gray-400 font-bold">კომენტარი</span>
                  <strong className="block text-sm text-blue-800 font-black">+{importResults.comments}</strong>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-emerald-800 hover:bg-emerald-950 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer"
                >
                  დახურვა
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
