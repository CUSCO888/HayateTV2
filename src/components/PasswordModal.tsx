import React, { useState } from 'react';
import { Lock, Delete, Check } from 'lucide-react';

interface PasswordModalProps {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  t: any;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ onConfirm, onCancel, t }) => {
  const [password, setPassword] = useState('');

  const handleKey = (key: string) => {
    if (key === 'C') {
      setPassword('');
    } else if (key === 'OK') {
      onConfirm(password);
    } else {
      if (password.length < 8) {
        setPassword(prev => prev + key);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]">
      <div className="bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="bg-[#00e676]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Lock className="text-[#00e676]" size={32} />
          </div>
          <h2 className="text-2xl font-bold">{t.enterPassword}</h2>
        </div>

        <div className="bg-black/40 p-6 rounded-2xl text-center text-4xl tracking-[1em] font-mono h-24 flex items-center justify-center">
          {'*'.repeat(password.length)}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {keys.map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className={`h-16 rounded-xl text-xl font-bold transition-all ${
                key === 'C' ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' :
                key === 'OK' ? 'bg-[#00e676]/20 text-[#00e676] hover:bg-[#00e676]/30' :
                'bg-white/5 hover:bg-white/10'
              }`}
            >
              {key === 'C' ? <Delete className="mx-auto" /> : key === 'OK' ? <Check className="mx-auto" /> : key}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-4 text-white/50 hover:text-white font-bold transition-colors"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
};

export default PasswordModal;
