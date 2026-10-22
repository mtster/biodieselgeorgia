import XLSX from 'xlsx-js-style';
import { Vendor, City, District, Direction, Warehouse, User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { KEY_VENDORS, KEY_CONTACTS, getLocal } from './localStorage';

export interface ExportVendorsOptions {
  cities: City[];
  districts: District[];
  directions: Direction[];
  warehouses: Warehouse[];
  users: User[];
  fallbackVendors?: Vendor[];
}

/**
 * Translates contact positions from English keys to Georgian UI translations
 */
export function formatContactPosition(pos?: string): string {
  if (!pos) return '';
  const clean = pos.trim().toLowerCase();
  if (clean === 'other' || clean === 'other position' || clean === 'სხვა თანამდებობა' || clean === 'სხვა') return 'სხვა';
  if (clean === 'director' || clean === 'director/owner' || clean === 'დირექტორი / მფლობელი' || clean === 'დირექტორი/მფლობელი' || clean === 'დირექტორი') return 'დირექტორი';
  if (clean === 'manager' || clean === 'მენეჯერი') return 'მენეჯერი';
  if (clean === 'accountant' || clean === 'ბუღალტერი') return 'ბუღალტერი';
  if (clean === 'cook' || clean === 'მზარეული') return 'მზარეული';
  if (clean === 'object_number' || clean === 'ობიექტის ნომერი') return 'ობიექტის ნომერი';
  if (clean === 'admin' || clean === 'administrator' || clean === 'ადმინისტრატორი') return 'ადმინისტრატორი';
  if (clean === 'logistics_manager' || clean === 'ლოჯისტიკის მენეჯერი') return 'ლოჯისტიკის მენეჯერი';
  if (clean === 'warehouse_manager' || clean === 'warehouse_head' || clean === 'საწყობის მენეჯერი') return 'საწყობის მენეჯერი';
  if (clean === 'driver' || clean === 'მძღოლი') return 'მძღოლი';
  return pos;
}

/**
 * Exports the entire vendors table to Excel format (.xlsx)
 * - Handles datasets > 1000 rows through chunked range fetching to avoid PostgREST limits.
 * - Exports both active and deleted vendors, styling deleted rows in soft red.
 * - Formats positions into Georgian.
 */
export async function exportAllVendorsToExcel(options: ExportVendorsOptions): Promise<{ count: number }> {
  const { cities, districts, directions, warehouses, users, fallbackVendors = [] } = options;

  let allVendors: Vendor[] = [];
  const contactsByVendor = new Map<string, any[]>();
  const BATCH_SIZE = 1000;

  if (isSupabaseConfigured && supabase) {
    // 1. Fetch ALL vendors (both active and is_deleted) in 1000-row chunks
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('trade_name', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('Error fetching vendors for export:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allVendors = allVendors.concat(data as Vendor[]);
        offset += data.length;
        if (data.length < BATCH_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // 2. Fetch all contacts in 1000-row chunks
    let cOffset = 0;
    let cHasMore = true;

    while (cHasMore) {
      const { data, error } = await supabase
        .from('vendor_contacts')
        .select('vendor_id, name, phone, position, note, is_default, sort_order')
        .range(cOffset, cOffset + BATCH_SIZE - 1);

      if (error) {
        console.warn('Error fetching vendor_contacts for export:', error);
        cHasMore = false;
        break;
      }

      if (data && data.length > 0) {
        data.forEach(c => {
          if (!c.vendor_id) return;
          const list = contactsByVendor.get(c.vendor_id) || [];
          list.push(c);
          contactsByVendor.set(c.vendor_id, list);
        });
        cOffset += data.length;
        if (data.length < BATCH_SIZE) {
          cHasMore = false;
        }
      } else {
        cHasMore = false;
      }
    }
  } else {
    // Fallback to local storage (including deleted vendors)
    allVendors = fallbackVendors.length > 0 
      ? fallbackVendors 
      : getLocal<Vendor[]>(KEY_VENDORS, []);

    const localContacts = getLocal<any[]>(KEY_CONTACTS, []);
    localContacts.forEach(c => {
      if (!c.vendor_id) return;
      const list = contactsByVendor.get(c.vendor_id) || [];
      list.push(c);
      contactsByVendor.set(c.vendor_id, list);
    });
  }

  // Exact column headers requested by user
  const headers = [
    'ობიექტის დასახელება',
    'იურ.დასხ',
    'ს/კ',
    'ფაქტიური მისამართი',
    'რაიონი',
    'მიმართულება',
    'საბანკო ანგარიში',
    'ფასი',
    'საკონტაქტო მეილი',
    'კონტაქტები',
    'კომენტარები',
    'ქალაქი',
    'კოდი',
    'მინიჭებული საწყობი',
    'გაყიდვების მენეჯერი',
    'ოპერაციების მენეჯერი'
  ];

  // Lookup maps for fast FK resolution
  const cityMap = new Map<string, string>();
  cities.forEach(c => {
    cityMap.set(c.id, c.name);
    cityMap.set(c.name, c.name);
  });

  const districtMap = new Map<string, string>();
  districts.forEach(d => {
    districtMap.set(d.id, d.name);
    districtMap.set(d.name, d.name);
  });

  const directionMap = new Map<string, string>();
  directions.forEach(d => {
    directionMap.set(d.id, d.name);
  });

  const warehouseMap = new Map<string, string>();
  warehouses.forEach(w => {
    warehouseMap.set(w.id, w.name);
  });

  const userMap = new Map<string, string>();
  users.forEach(u => {
    userMap.set(u.id, u.name);
  });

  const rows = allVendors.map(vendor => {
    // 1. ობიექტის დასახელება(trade_name)
    const tradeName = vendor.trade_name || '';

    // 2. იურ.დასხ(company_name)
    const companyName = vendor.company_name || '';

    // 3. ს/კ(id_code)
    const idCode = vendor.id_code || '';

    // 4. ფაქტიური მისამართი(address)
    const address = vendor.address || '';

    // 5. რაიონი(district. fk)
    const districtName = districtMap.get(vendor.district) || vendor.district || '';

    // 6. მიმართულება(direction_id. fk from directions table)
    const directionName = vendor.direction_id ? (directionMap.get(vendor.direction_id) || '') : '';

    // 7. საბანკო ანგარიში(bank_account)
    const bankAccount = vendor.bank_account || '';

    // 8. ფასი(price_per_liter)
    const price = vendor.price_per_liter != null ? Number(vendor.price_per_liter) : 0;

    // 9. საკონტაქტო მეილი(email)
    const email = vendor.email || '';

    // 10. კონტაქტები (name(position)-phone[note], arranged by is_default first, then sort_order)
    const contactList = [...(contactsByVendor.get(vendor.id) || vendor.contacts || [])];
    contactList.sort((a, b) => {
      const aDef = a.is_default === true || (a.is_default as any) === 'true';
      const bDef = b.is_default === true || (b.is_default as any) === 'true';
      if (aDef && !bDef) return -1;
      if (!aDef && bDef) return 1;
      const aOrder = typeof a.sort_order === 'number' && !isNaN(a.sort_order) ? a.sort_order : 0;
      const bOrder = typeof b.sort_order === 'number' && !isNaN(b.sort_order) ? b.sort_order : 0;
      return bOrder - aOrder;
    });

    const formattedContacts = contactList.map(c => {
      const name = (c.name || '').trim();
      const posGe = formatContactPosition(c.position);
      const pos = posGe ? `(${posGe})` : '';
      const phone = (c.phone || '').trim();
      const note = c.note ? `[${c.note}]` : '';
      return `${name}${pos}-${phone}${note}`;
    }).join(', ');

    // 11. კომენტარები: author(comment), author(comment). sort by created_at/date. most recent first, oldest last
    const commentList = [...(vendor.comments || [])];
    commentList.sort((a, b) => {
      const timeA = new Date(a.date || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.date || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });

    const formattedComments = commentList.map(c => {
      const author = (c.user_id ? userMap.get(c.user_id) : null) || c.user_name || 'System';
      const commentText = (c.comment || '').trim();
      return `${author}(${commentText})`;
    }).join(', ');

    // 12. ქალაქი(city fk from cities table)
    const cityName = cityMap.get(vendor.city) || vendor.city || '';

    // 13. კოდი(company_code)
    const companyCode = vendor.company_code || '';

    // 14. მინიჭებული საწყობი(warehouse_id. fk warehouses table)
    const warehouseName = vendor.warehouse_id ? (warehouseMap.get(vendor.warehouse_id) || '') : '';

    // 15. გაყიდვების მენეჯერი(manager_id. fk profiles table)
    const managerName = vendor.manager_id ? (userMap.get(vendor.manager_id) || '') : '';

    // 16. ოპერაციების მენეჯერი(operator_id. fk profiles table)
    const operatorName = vendor.operator_id ? (userMap.get(vendor.operator_id) || '') : '';

    return {
      'ობიექტის დასახელება': tradeName,
      'იურ.დასხ': companyName,
      'ს/კ': idCode,
      'ფაქტიური მისამართი': address,
      'რაიონი': districtName,
      'მიმართულება': directionName,
      'საბანკო ანგარიში': bankAccount,
      'ფასი': price,
      'საკონტაქტო მეილი': email,
      'კონტაქტები': formattedContacts,
      'კომენტარები': formattedComments,
      'ქალაქი': cityName,
      'კოდი': companyCode,
      'მინიჭებული საწყობი': warehouseName,
      'გაყიდვების მენეჯერი': managerName,
      'ოპერაციების მენეჯერი': operatorName
    };
  });

  // Build worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Column width calculations for readability
  worksheet['!cols'] = [
    { wch: 25 }, // ობიექტის დასახელება
    { wch: 25 }, // იურ.დასხ
    { wch: 14 }, // ს/კ
    { wch: 30 }, // ფაქტიური მისამართი
    { wch: 16 }, // რაიონი
    { wch: 18 }, // მიმართულება
    { wch: 24 }, // საბანკო ანგარიში
    { wch: 10 }, // ფასი
    { wch: 22 }, // საკონტაქტო მეილი
    { wch: 35 }, // კონტაქტები
    { wch: 40 }, // კომენტარები
    { wch: 16 }, // ქალაქი
    { wch: 14 }, // კოდი
    { wch: 20 }, // მინიჭებული საწყობი
    { wch: 22 }, // გაყიდვების მენეჯერი
    { wch: 22 }  // ოპერაციების მენეჯერი
  ];

  // Header row styling
  headers.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ c: colIdx, r: 0 });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: 'E2F0D9' }
        },
        font: {
          bold: true,
          color: { rgb: '1B5E20' }
        },
        alignment: {
          vertical: 'center',
          horizontal: 'center'
        }
      };
    }
  });

  // Highlight rows that are is_deleted: true in red
  allVendors.forEach((vendor, idx) => {
    if (vendor.is_deleted) {
      const rowIndex = idx + 1; // 0 is header row
      headers.forEach((_, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ c: colIdx, r: rowIndex });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFD2D2' } // Soft light red background
            },
            font: {
              color: { rgb: '9C0006' }, // Dark red text
              bold: true
            }
          };
        }
      });
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'მომწოდებლები');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const fileName = `მომწოდებლები_${dateStr}.xlsx`;

  // Generate Excel buffer and download cleanly via browser Blob (avoids Node fs/stream warnings)
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);

  return { count: allVendors.length };
}
