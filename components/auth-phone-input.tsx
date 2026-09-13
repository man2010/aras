'use client';

import { useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

type AuthPhoneInputProps = {
  name?: string;
  required?: boolean;
  placeholder?: string;
};

export function AuthPhoneInput({
  name = 'contact',
  required,
  placeholder = '77 123 45 67',
}: AuthPhoneInputProps) {
  const [phone, setPhone] = useState('');

  return (
    <div className="auth-phone-input mt-2">
      <PhoneInput
        defaultCountry="sn"
        preferredCountries={['sn', 'fr', 'ci', 'ml', 'gm', 'ma', 'cm', 'cd']}
        value={phone}
        onChange={(value) => setPhone(value)}
        placeholder={placeholder}
        forceDialCode
        inputProps={{ required, autoComplete: 'tel' }}
        countrySelectorStyleProps={{
          buttonClassName: 'auth-phone-input__country-button',
          dropdownStyleProps: {
            className: 'auth-phone-input__dropdown',
            listItemClassName: 'auth-phone-input__dropdown-item',
          },
        }}
        inputClassName="auth-phone-input__field"
        className="auth-phone-input__container"
      />
      <input type="hidden" name={name} value={phone} required={required} />
    </div>
  );
}
