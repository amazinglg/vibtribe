import { create } from 'zustand';

interface ChatStore {
  selectedChatId: string | null;
  isSecureSession: boolean;
  setSelectedChatId: (id: string | null) => void;
  openSecureChat: (id: string) => void;
  closeSecureChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  selectedChatId: null,
  isSecureSession: false,
  setSelectedChatId: (id) => set({ selectedChatId: id, isSecureSession: false }),
  openSecureChat: (id) => set({ selectedChatId: id, isSecureSession: true }),
  closeSecureChat: () => set({ selectedChatId: null, isSecureSession: false }),
}));