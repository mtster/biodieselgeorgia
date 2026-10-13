import React from 'react';
import { FormInput } from '../../FormInput';
import { t } from '../../../utils/lang';

interface Props {
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  passwordInput: string;
  setPasswordInput: (val: string) => void;
  usernameError?: string;
  passwordError?: string;
  onClearErrors?: (field: 'username' | 'password') => void;
}

export const VendorAccountSection: React.FC<Props> = ({
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  usernameError,
  passwordError,
  onClearErrors
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Supplier Login Account")}
      </span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Username")}
          type="text"
          fontClass="font-mono"
          value={usernameInput}
          onChange={(e) => {
            setUsernameInput(e.target.value);
            if (usernameError) onClearErrors?.('username');
          }}
          error={usernameError}
          autoComplete="new-password"
          name="vendor-username-field"
        />
        <FormInput
          label={t("Password (min. 6 symbols)")}
          type="password"
          value={passwordInput}
          onChange={(e) => {
            setPasswordInput(e.target.value);
            if (passwordError) onClearErrors?.('password');
          }}
          error={passwordError}
          autoComplete="new-password"
          name="vendor-password-field"
        />
      </div>
    </div>
  );
};
