import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, X, Upload, CheckCircle, Loader2, Users, MapPin, 
  AlertCircle, ChevronRight, Info, Sparkles, Check 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveCity, saveDistrict } from '../../services/lookupService';
import { saveUser } from '../../services/userService';
import { saveVendor } from '../../services/vendorService';
import { City, District, User, Vendor, VendorContact, VendorComment, Warehouse } from '../../types';
import { t } from '../../utils/lang';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  currentUser: User;
  onComplete: () => void;
}

type Step = 'upload' | 'scanning' | 'resolve' | 'importing' | 'success';

interface ManagerFormState {
  name: string;
  email: string;
  personal_id: string;
  phone: string;
}

// Normalized excel header map matching
const normalizationMapping: Record<string, string> = {
  "ობიექტისდასახელება": "trade_name",
  "იურ.დასხ.": "company_name",
  "იურ.დასხ": "company_name",
  "ს/კ": "id_code",
  "ფაქტიურიმისამართი": "address",
  "საბანკორეკვიზიტები": "bank_account",
  "ფასი(თეთრი)": "price_per_liter",
  "ფასი": "price_per_liter",
  "კონტაქტი": "contact_cell",
  "ბუღალტერისსაკონტაქტო": "accountant_cell",
  "ქალაქი": "city",
  "უბანი": "district",
  "კოდი": "company_code",
  "სტატუსი": "status",
  "შენიშვნა/მთავარიკომენტარი": "comment_cell",
  "შენიშვნა": "comment_cell",
  "ბოლოგატანა": "last_pickup_cell",
  "მოკითხვისდრო": "contact_time_cell",
  "კომენტარიმაისი": "may_comments_cell",
  "კომენტარიაპრილი": "april_comments_cell",
  "მენეჯერი": "manager"
};

const normalizeHeader = (h: any): string => {
  if (!h) return '';
  return h.toString()
    .replace(/["'\n\r]/g, '') // remove quotes/newlines
    .replace(/\s+/g, '')       // remove all whitespace
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
  isOpen, onClose, warehouses, users, cities, districts, currentUser, onComplete 
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local copies of lookups to survive in-session updates
  const [localCities, setLocalCities] = useState<City[]>(cities);
  const [localDistricts, setLocalDistricts] = useState<District[]>(districts);

  useEffect(() => {
    setLocalCities(cities);
  }, [cities]);

  useEffect(() => {
    setLocalDistricts(districts);
  }, [districts]);

  // Parsed sheet rows
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Pre-flight scan outcomes
  const [missingCities, setMissingCities] = useState<string[]>([]);
  const [missingDistricts, setMissingDistricts] = useState<{ city: string; district: string }[]>([]);
  const [missingManagers, setMissingManagers] = useState<string[]>([]);

  // Resolving maps: ExcelName -> DatabaseId
  const [cityResolutionMap, setCityResolutionMap] = useState<Record<string, string>>({});
  const [districtResolutionMap, setDistrictResolutionMap] = useState<Record<string, string>>({});
  const [managerResolutionMap, setManagerResolutionMap] = useState<Record<string, string>>({});

  // Single-by-single interactive manager flow
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
      setMissingManagers([]);
      setCityResolutionMap({});
      setDistrictResolutionMap({});
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

  // 1. Process local file load via SheetJS
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

        // Ensure we mapped at least the trade name!
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
            city: val('city'),
            district: val('district'),
            company_code: val('company_code'),
            status: val('status') || 'Active',
            contact_cell: val('contact_cell'),
            accountant_cell: val('accountant_cell'),
            comment_cell: val('comment_cell'),
            last_pickup_cell: val('last_pickup_cell'),
            contact_time_cell: val('contact_time_cell'),
            may_comments_cell: val('may_comments_cell'),
            april_comments_cell: val('april_comments_cell'),
            manager: val('manager')
          };
        }).filter(r => r.trade_name !== '');

        setRawRows(parsedRowsClean);
        setErrorMsg(null);

        // Analyze missing items
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
        const sheetManagers = Array.from(new Set(parsedRowsClean.map(r => r.manager).filter(Boolean))) as string[];

        // Map lowercases for matching checks
        const dbCitiesLower = localCities.map(c => c.name.trim().toLowerCase());
        const dbDistrictsLower = localDistricts.map(d => d.name.trim().toLowerCase());
        const dbUsersLower = users.map(u => u.name.trim().toLowerCase());

        const missingC = sheetCities.filter(sc => !dbCitiesLower.includes(sc.trim().toLowerCase()));
        const missingD = sheetDistricts.filter(sd => !dbDistrictsLower.includes(sd.district.trim().toLowerCase()));
        const missingM = sheetManagers.filter(sm => !dbUsersLower.includes(sm.trim().toLowerCase()));

        setMissingCities(missingC);
        setMissingDistricts(missingD);
        setMissingManagers(missingM);

        // Pre-build default resolutions (for existing lookup items mapping)
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

        const initManagerMap: Record<string, string> = {};
        users.forEach(u => {
          initManagerMap[u.name.trim().toLowerCase()] = u.id;
          initManagerMap[u.name.trim()] = u.id;
        });

        setCityResolutionMap(initCityMap);
        setDistrictResolutionMap(initDistrictMap);
        setManagerResolutionMap(initManagerMap);

        // Move to resolution step directly if anything missing, else start processing
        if (missingC.length > 0 || missingD.length > 0 || missingM.length > 0) {
          setStep('resolve');
        } else {
          // All good! Auto bypass to processing directly with initial mappings
          executeImportStep(parsedRowsClean, initCityMap, initDistrictMap, initManagerMap);
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

  // 2. Interactive user creations
  const handleCreateManager = async () => {
    if (!managerForm.name.trim() || !managerForm.email.trim()) {
      alert('მიუთითეთ სახელი და ელ.ფოსტა');
      return;
    }
    setIsCreatingManager(true);
    try {
      // Complete user registration details
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

      const createdUser = await saveUser(userPayload, currentUser.name || 'System Import');
      
      // Update mappings
      setManagerResolutionMap(prev => ({
        ...prev,
        [managerForm.name.trim().toLowerCase()]: createdUser.id,
        [managerForm.name.trim()]: createdUser.id
      }));

      // Next
      setCurrentManagerIdx(prev => prev + 1);
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ მენეჯერის შექმნა ვერ მოხერხდა: ${e.message}`);
    } finally {
      setIsCreatingManager(false);
    }
  };

  const handleSkipManager = () => {
    // Record skipped name as unmapped
    const skippedName = missingManagers[currentManagerIdx];
    setManagerResolutionMap(prev => ({
      ...prev,
      [skippedName.trim().toLowerCase()]: '',
      [skippedName.trim()]: ''
    }));
    setCurrentManagerIdx(prev => prev + 1);
  };

  const handleResolveAndProceedList = async (resolveEntries: boolean) => {
    setStep('scanning');
    
    let resolvedCityIds = { ...cityResolutionMap };
    let resolvedDistrictIds = { ...districtResolutionMap };

    if (resolveEntries) {
      setProgressMsg('პარალელურად იქმნება ახალი ქალაქები და უბნები...');
      try {
        // A. Save Missing Cities if any
        const newCitiesList: City[] = [];
        for (const cityName of missingCities) {
          const savedC = await saveCity({
            id: '',
            name: cityName,
            is_deleted: false
          }, currentUser.name);
          resolvedCityIds[cityName.trim().toLowerCase()] = savedC.id;
          resolvedCityIds[cityName.trim()] = savedC.id;
          newCitiesList.push(savedC);
        }
        if (newCitiesList.length > 0) {
          setLocalCities(prev => [...prev, ...newCitiesList]);
        }

        // B. Save Missing Districts if any
        const newDistrictsList: District[] = [];
        for (const distInfo of missingDistricts) {
          // Wait, find city ID of parent
          const parentCityLower = distInfo.city.trim().toLowerCase();
          const cityId = resolvedCityIds[parentCityLower] || resolvedCityIds[distInfo.city] || '';
          
          if (cityId) {
            const savedD = await saveDistrict({
              id: '',
              city_id: cityId,
              name: distInfo.district
            }, currentUser.name);
            resolvedDistrictIds[distInfo.district.trim().toLowerCase()] = savedD.id;
            resolvedDistrictIds[distInfo.district.trim()] = savedD.id;
            newDistrictsList.push(savedD);
          }
        }
        if (newDistrictsList.length > 0) {
          setLocalDistricts(prev => [...prev, ...newDistrictsList]);
        }
      } catch (e) {
        console.error('Error auto-creating locations:', e);
      }
    }

    // Clear missing domains to hide the city and district mapper
    setMissingCities([]);
    setMissingDistricts([]);

    // Move to next step of wizard: manager check
    const managerIndex = 0;
    setCurrentManagerIdx(0);
    
    // If no missing managers or bypassed managers creation, start bulk processing!
    if (missingManagers.length === 0) {
      executeImportStep(rawRows, resolvedCityIds, resolvedDistrictIds, managerResolutionMap);
    } else {
      setCityResolutionMap(resolvedCityIds);
      setDistrictResolutionMap(resolvedDistrictIds);
      setStep('resolve');
    }
  };

  // Skip all remaining manager profiles with single click
  const handleSkipAllManagersAndProceed = () => {
    const finalManagersMap = { ...managerResolutionMap };
    missingManagers.slice(currentManagerIdx).forEach(mgr => {
      finalManagersMap[mgr.trim().toLowerCase()] = '';
      finalManagersMap[mgr.trim()] = '';
    });
    setManagerResolutionMap(finalManagersMap);
    executeImportStep(rawRows, cityResolutionMap, districtResolutionMap, finalManagersMap);
  };

  // Submit resolved managers & run import batch loops!
  const handleAcceptManagersAndImport = () => {
    executeImportStep(rawRows, cityResolutionMap, districtResolutionMap, managerResolutionMap);
  };


  // 3. Batch process execution using Gemini 3.5 Flash JSON proxy
  const executeImportStep = async (
    allParsedRows: any[], 
    cityIdMap: Record<string, string>, 
    districtIdMap: Record<string, string>, 
    managerIdMap: Record<string, string>
  ) => {
    setStep('importing');
    setTotalRows(allParsedRows.length);
    setProcessedRows(0);
    setProgressMsg('მზადდება მონაცემები იმპორტისთვის...');

    let importCount = 0;
    let contactsCount = 0;
    let commentsCount = 0;

    const batchSize = 50;

    try {
      for (let i = 0; i < allParsedRows.length; i += batchSize) {
        const batchRows = allParsedRows.slice(i, i + batchSize);
        const batchProgressText = `პროცესინგი: იგზავნება ${i + 1}-დან ${Math.min(i + batchSize, allParsedRows.length)}-მდე ჩანაწერი Gemini API-ში...`;
        setProgressMsg(batchProgressText);

        // Form payload for Gemini structure API
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

        // Request Supabase Edge Function directly
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
        const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

        const res = await fetch(`${supabaseUrl}/functions/v1/import-excel`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ rows: payloadRows })
        });

        if (!res.ok) {
          const errRes = await res.json();
          throw new Error(errRes.error || `Gemini proxy returned ${res.status}`);
        }

        const resData = await res.json();
        const geminiParsedList: any[] = resData.data || [];

        // Build mapping lookup of AI extractions
        const aiMap: Record<string, any> = {};
        geminiParsedList.forEach(item => {
          if (item.row_id) {
            aiMap[item.row_id] = item;
          }
        });

        setProgressMsg(`ბაზაში იწერება დამუშავებული ${batchRows.length} მიმწოდებელი...`);

        // Perform parallel vendor saving for this batch
        await Promise.all(batchRows.map(async (row) => {
          const aiExtract = aiMap[row.row_id] || { contacts: [], comments: [] };

          // Build clean entities mapped
          const mappedCityId = cityIdMap[row.city.trim().toLowerCase()] || cityIdMap[row.city.trim()] || '';
          const mappedCityName = localCities.find(c => c.id === mappedCityId)?.name || row.city || 'Tbilisi';

          const mappedDistrictId = districtIdMap[row.district.trim().toLowerCase()] || districtIdMap[row.district.trim()] || '';
          const mappedDistrictName = localDistricts.find(d => d.id === mappedDistrictId)?.name || row.district || 'Saburtalo';

          const mappedManagerId = managerIdMap[row.manager.trim().toLowerCase()] || managerIdMap[row.manager.trim()] || currentUser.id;

          // Default safe values for missing columns
          const finalVendor: Vendor = {
            id: '', // let saveVendor auto generate
            id_code: row.id_code || '204857392',
            company_name: row.company_name || row.trade_name,
            trade_name: row.trade_name,
            company_code: row.company_code || row.id_code || '',
            bank_account: row.bank_account || 'GE00TB0000000000000000',
            city: mappedCityName,
            district: mappedDistrictName,
            address: row.address || 'Imported Address',
            price_per_liter: row.price_per_liter || 0.05,
            warehouse_id: warehouses[0]?.id || '',
            manager_id: mappedManagerId,
            operator_id: currentUser.id,
            working_hours: '09:00 - 18:00',
            status: 'Active',
            barrels_amount: 0,
            contacts: aiExtract.contacts.map((c: any, cIdx: number) => ({
              id: `cont-imp-${row.row_id}-${cIdx}-${Math.random().toString(36).substring(2, 5)}`,
              name: c.name || 'კონტაქტი',
              phone: c.phone || '',
              position: c.position || 'other',
              note: c.note || '',
              is_default: c.is_default !== undefined ? c.is_default : (cIdx === 0)
            })),
            comments: aiExtract.comments.map((cm: any, cmIdx: number) => ({
              id: `comm-imp-${row.row_id}-${cmIdx}-${Math.random().toString(36).substring(2, 5)}`,
              comment: cm.comment || 'კომენტარი',
              date: cm.date || new Date().toISOString().split('T')[0],
              user_name: cm.user_name || 'System Import'
            })),
            created_at: new Date().toISOString()
          };

          await saveVendor(finalVendor, currentUser.name || 'System');
          
          importCount++;
          contactsCount += finalVendor.contacts.length;
          commentsCount += finalVendor.comments.length;
        }));

        setProcessedRows(prev => Math.min(prev + batchRows.length, allParsedRows.length));
      }

      setImportResults({ vendors: importCount, contacts: contactsCount, comments: commentsCount });
      setStep('success');

      // Trigger high-level parent state reload
      onComplete();

    } catch (e: any) {
      console.error('Core import process exception:', e);
      setErrorMsg(e.message || 'იმპორტის პროცესში მოხდა ტექნიკური შეცდომა.');
      setStep('upload');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* HEADER AREA */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-shrink-0">
          <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
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

        {/* WIZARD SCREENS CONTAINER - COLLAPSIBLE BODY */}
        <div className="flex-1 overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 text-xs animate-in slide-in-from-top-2 duration-200">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black">შეცდომა / Error:</strong>
                <p className="font-medium mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* SCREEN 1: FILE COOP / PASTE UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag/Drop Box */}
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
                
                <div className="w-12 h-12 rounded-full bg-emerald-150 text-emerald-800 flex items-center justify-center">
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
                  იმპორტის შემოწმება
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
                <p className="text-xs text-gray-500 max-w-sm">{progressMsg || 'ვეძებთ ახალ მომხმარებლებს, ქალაქებსა და უბნებს ჩანაცვლებამდე...'}</p>
              </div>
            </div>
          )}

          {/* SCREEN 3: RESOLVE MISSING ENTITIES WIZARD STEP */}
          {step === 'resolve' && (
            <div className="space-y-5 animate-in fade-in duration-250">
              
              {/* STAGE A: Cities and Districts Resolve Card */}
              {(missingCities.length > 0 || missingDistricts.length > 0) ? (
                <div className="border border-amber-250 bg-amber-50 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-amber-800 shrink-0 mt-0.5 animate-bounce" size={18} />
                    <div className="font-sans">
                      <h4 className="font-extrabold text-xs text-amber-950">ლოკაციების სინქრონიზაცია</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">Excel-ში აღმოჩნდა ქალაქები ან უბნები, რომლებიც არ არსებობს საწყის მონაცემებში. გსურთ მათი ავტომატურად დამატება ბაზაში?</p>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto bg-white/75 rounded-xl p-3 border border-amber-100 space-y-2 text-[11px] font-sans">
                    {missingCities.map(c => (
                      <div key={c} className="flex items-center gap-1.5 text-amber-950 font-bold">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        ქალაქი (New City): <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{c}</strong>
                      </div>
                    ))}
                    {missingDistricts.map(d => (
                      <div key={`${d.city}-${d.district}`} className="flex items-center gap-1.5 text-amber-950">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        უბანი (New District): <strong className="text-amber-900 bg-amber-100/50 px-1.5 py-0.5 rounded">{d.city} &gt; {d.district}</strong>
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

              {/* STAGE B: Users/Managers One-by-One sequential registration */}
              {missingCities.length === 0 && missingDistricts.length === 0 && missingManagers.length > 0 && currentManagerIdx < missingManagers.length ? (
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
                      ამ მენეჯერის გამოტოვება (Skip)
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
              {missingCities.length === 0 && missingDistricts.length === 0 && (missingManagers.length === 0 || currentManagerIdx >= missingManagers.length) && (
                <div className="text-center py-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={22} className="animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-black text-sm text-gray-800">იდენტიფიცირება დასრულებულია</h5>
                    <p className="text-xs text-gray-500">ყველა საჭირო ახალი მენეჯერი და ლოკაცია მზადაა დასაკავშირებლად.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAcceptManagersAndImport}
                    className="px-6 py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-black rounded-xl text-xs transition"
                  >
                    იმპორტის დაწყება
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SCREEN 4: PROGRESS BAR LOOPS OF GEMINI EXTRACTION */}
          {step === 'importing' && (
            <div className="py-8 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 justify-center">
                <Loader2 className="animate-spin text-emerald-700" size={24} />
                <h4 className="font-extrabold text-xs text-emerald-950 font-sans uppercase tracking-wider">
                  მონაცემების იმპორტი (50-იანი პაკეტებით)...
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
                <div className="flex justify-between text-[10px] text-gray-500 font-bold font-sans">
                  <span>დამუშავდა: {processedRows} რიგი</span>
                  <span>სულ: {totalRows} რიგი</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-[11px] leading-relaxed font-sans text-gray-600 block max-h-32 overflow-y-auto">
                <div className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                  <p>{progressMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: SUCCESS REPORT SUMMARY */}
          {step === 'success' && (
            <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-200 font-sans">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-black text-sm text-gray-800">იმპორტი წარმატებით დასრულდა!</h3>
                <p className="text-xs text-gray-500">მონაცემები სრულად დამუშავდა და გადაიწერა ძირითად მონაცემთა ბაზაში.</p>
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
                  className="px-6 py-2 bg-emerald-800 hover:bg-emerald-950 text-white rounded-xl text-xs font-black transition shadow-sm"
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
