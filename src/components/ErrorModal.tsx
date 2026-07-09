import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '../utils/lang';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  errorMsg: string;
}

export function translateSupabaseErrorToGeorgian(errorMsg: string): string {
  if (!errorMsg) return t("მოხდა გაურკვეველი შეცდომა.");
  
  const msgLower = errorMsg.toLowerCase();
  
  // 1. Check Not-Null violations first using regex to preserve column and relation names
  const notNullRegex = /null value in column "([^"]+)"(?: of relation "([^"]+)")? violates not-null constraint/i;
  const notNullMatch = errorMsg.match(notNullRegex);
  if (notNullMatch) {
    const col = notNullMatch[1];
    const rel = notNullMatch[2] || '';
    return `მონაცემის შენახვა ვერ მოხერხდა: სავალდებულო ველი "${col}"${rel ? ` ცხრილში "${rel}"` : ''} არის ცარიელი (null).`;
  }
  
  // Specific Database Foreign Key Constraints
  if (msgLower.includes("orders_truck_plate_fkey")) {
    return "მითითებული ტრანსპორტის ნომერი ვერ მოიძებნა ტრანსპორტის ბაზაში.";
  }
  if (msgLower.includes("orders_driver_id_fkey")) {
    return "მითითებული მძღოლი ვერ მოიძებნა თანამშრომლების ბაზაში.";
  }
  if (msgLower.includes("orders_companion_id_fkey")) {
    return "მითითებული დამხმარე ვერ მოიძებნა თანამშრომლების ბაზაში.";
  }
  if (msgLower.includes("orders_vendor_id_fkey")) {
    return "მითითებული მომწოდებელი ვერ მოიძებნა მომწოდებლების ბაზაში.";
  }
  if (msgLower.includes("orders_warehouse_id_fkey")) {
    return "მითითებული საწყობი ვერ მოიძებნა საწყობების ბაზაში.";
  }
  
  // Regex for general violates foreign key constraint
  const fkRegex = /violates foreign key constraint "([^"]+)" of relation "([^"]+)"/i;
  const fkMatch = errorMsg.match(fkRegex);
  if (fkMatch) {
    const constraint = fkMatch[1];
    const rel = fkMatch[2];
    return `მონაცემების შენახვა ვერ მოხერხდა კავშირის შეზღუდვის გამო: დაკავშირებული ჩანაწერი არ არსებობს (შეზღუდვა "${constraint}" ცხრილში "${rel}").`;
  }

  if (msgLower.includes("violates foreign key constraint") || msgLower.includes("foreign key violation") || msgLower.includes("foreign_key_violation")) {
    return "მონაცემების შენახვა ვერ მოხერხდა კავშირის შეზღუდვის გამო (მითითებული დაკავშირებული მონაცემი არ არსებობს შესაბამის ბაზაში).";
  }
  
  // Regex for unique constraint duplicate values
  const uniqueRegex = /duplicate key value violates unique constraint "([^"]+)"/i;
  const uniqueMatch = errorMsg.match(uniqueRegex);
  if (uniqueMatch) {
    const constraint = uniqueMatch[1];
    if (constraint.includes("plate_number") || constraint.includes("license_plate")) {
      return "ეს სახელმწიფო ნომერი უკვე რეგისტრირებულია სხვა ტრანსპორტზე.";
    }
    return `ეს ჩანაწერი უკვე არსებობს ბაზაში (დუბლირების შეზღუდვის დარღვევა: "${constraint}").`;
  }

  if (msgLower.includes("unique constraint") || msgLower.includes("unique_violation") || msgLower.includes("already exists")) {
    if (msgLower.includes("plate_number") || msgLower.includes("license_plate")) {
      return "ეს სახელმწიფო ნომერი უკვე რეგისტრირებულია სხვა ტრანსპორტზე.";
    }
    return "ეს ჩანაწერი უკვე არსებობს ბაზაში (დუბლირების შეზღუდვის დარღვევა).";
  }

  if (
    msgLower.includes("already been registered") || 
    msgLower.includes("already registered") || 
    msgLower.includes("user_already_exists")
  ) {
    return "მომხმარებელი ამ ელ-ფოსტით ან სახელით უკვე რეგისტრირებულია სისტემაში.";
  }
  if (
    msgLower.includes("password should be at least 6 characters") || 
    msgLower.includes("password is too short") ||
    msgLower.includes("password should be")
  ) {
    return "პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან.";
  }
  if (
    msgLower.includes("invalid login credentials") || 
    msgLower.includes("incorrect email or password") ||
    msgLower.includes("invalid_credentials")
  ) {
    return "არასწორი ელ-ფოსტა/მომხმარებლის სახელი ან პაროლი.";
  }
  if (msgLower.includes("email address not authorized")) {
    return "ელ-ფოსტა არ არის ავტორიზებული სისტემაში შესასვლელად.";
  }
  if (
    msgLower.includes("network request failed") || 
    msgLower.includes("failed to fetch") ||
    msgLower.includes("network error")
  ) {
    return "ქსელის კავშირი ვერ დამყარდა. გთხოვთ შეამოწმოთ ინტერნეტის კავშირი.";
  }
  if (
    msgLower.includes("insufficient permissions") || 
    msgLower.includes("missing or insufficient permissions") || 
    msgLower.includes("access denied") || 
    msgLower.includes("unauthorized") ||
    msgLower.includes("permission denied")
  ) {
    return "წვდომა უარყოფილია: თქვენ არ გაქვთ ამ მოქმედების შესრულების უფლება.";
  }
  if (msgLower.includes("service role key") || msgLower.includes("service_role_key")) {
    return "სისტემური შეცდომა: სერვერის ავტორიზაციის გასაღები არ არის კონფიგურირებული.";
  }
  if (msgLower.includes("edge function failed") || msgLower.includes("function failed")) {
    if (msgLower.includes("already been registered") || msgLower.includes("already registered")) {
      return "მომხმარებელი ამ ელ-ფოსტით ან სახელით უკვე რეგისტრირებულია სისტემაში.";
    }
    return "სერვერის ფუნქციის შესრულება ვერ მოხერხდა. გთხოვთ გადაამოწმოთ მონაცემების სისწორე.";
  }

  // Fallback default message in Georgian
  return `ოპერაცია ვერ შესრულდა სერვერის შეცდომის გამო (${errorMsg}).`;
}

export default function ErrorModal({
  isOpen,
  onClose,
  title,
  errorMsg
}: ErrorModalProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen) return null;

  const georgianMessage = translateSupabaseErrorToGeorgian(errorMsg);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-red-100 animate-in zoom-in-95 duration-150">
        
        {/* Beautiful Warning Badge */}
        <div className="mx-auto w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-xs border border-red-100">
          <AlertTriangle size={28} />
        </div>
        
        {/* Header Title */}
        <div className="space-y-2 text-center">
          <h3 className="font-black text-sm text-gray-950 px-2 tracking-tight">
            {t(title)}
          </h3>
          
          {/* Main Georgian Error Message */}
          <div className="text-xs text-red-800 font-bold bg-red-50/50 p-3.5 rounded-2xl border border-red-50/70 leading-relaxed font-sans">
            {georgianMessage}
          </div>
        </div>

        {/* Collapsible area for unredacted technical details */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-[10px] font-semibold text-gray-400 hover:text-gray-655 flex items-center justify-center gap-1 mx-auto underline cursor-pointer select-none"
          >
            {showTechnicalDetails ? (
              <>
                <span>{t("ტექნიკური დეტალების დამალვა")}</span>
                <ChevronUp size={12} />
              </>
            ) : (
              <>
                <span>{t("დეტალური ტექნიკური ინფორმაციის ჩვენება")}</span>
                <ChevronDown size={12} />
              </>
            )}
          </button>

          {showTechnicalDetails && (
            <div className="mt-3 text-left bg-slate-50 border border-slate-100 p-3 rounded-xl max-h-[140px] overflow-y-auto animate-in slide-in-from-top-2 duration-150">
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase font-mono block mb-1">
                Raw Error Payload:
              </span>
              <p className="font-mono text-[10px] text-slate-600 leading-normal whitespace-pre-wrap">
                {errorMsg}
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Button */}
        <div className="pt-1 select-none">
          <button 
            type="button"
            onClick={() => {
              setShowTechnicalDetails(false);
              onClose();
            }} 
            className="w-full px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-md active:bg-emerald-950"
          >
            {t("გასაგებია")}
          </button>
        </div>

      </div>
    </div>
  );
}
