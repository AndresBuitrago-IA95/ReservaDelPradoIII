/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  Store, 
  PlusCircle, 
  ShieldCheck, 
  Info, 
  MessageCircle, 
  Mail,
  CreditCard, 
  Phone,
  LayoutGrid,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Camera,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import { Entrepreneurship, EntrepreneurshipStatus, AppConfig, OperationType } from './types';
import { handleFirestoreError, cn } from './lib/utils';

// Constantes
const ADMIN_EMAIL = "andrezbuitrago82@gmail.com";
const CATEGORIES = ["Alimentos", "Servicios", "Artesanías", "Salud y Belleza", "Moda", "Mascotas", "Otros"];

const Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 280 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Detailed Wreathe Icon from image */}
    <g transform="translate(100, 5)">
      <circle cx="40" cy="40" r="38" fill="#1B2E3C" />
      {/* Small leaf shapes in a circular pattern */}
      {[...Array(24)].map((_, i) => (
        <path 
          key={i}
          d="M40 15C42 12 45 12 47 15C49 18 47 22 40 25C33 22 31 18 33 15C35 12 38 12 40 15Z" 
          fill="#84BD00"
          transform={`rotate(${i * 15} 40 40) translate(0, -5)`}
        />
      ))}
      {[...Array(12)].map((_, i) => (
        <path 
          key={`inner-${i}`}
          d="M40 25C41.5 23 43.5 23 45 25C46.5 27 45 30 40 32C35 30 33.5 27 35 25C36.5 23 38.5 23 40 25Z" 
          fill="#A4D233"
          transform={`rotate(${i * 30 + 15} 40 40) translate(0, -3)`}
        />
      ))}
      <circle cx="40" cy="40" r="10" fill="#84BD00" opacity="0.8" />
    </g>

    {/* Text: RESERVA */}
    <text x="140" y="65" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="32" fill="#1B2E3C" letterSpacing="-0.02em">RESERVA</text>
    
    {/* Text: del Prado */}
    <text x="140" y="88" textAnchor="middle" fontFamily="Playfair Display, serif" fontStyle="italic" fontSize="28" fill="#84BD00">del Prado</text>
    
    {/* Line */}
    <line x1="40" y1="92" x2="240" y2="92" stroke="#1B2E3C" strokeWidth="0.5" opacity="0.3" />
    
    {/* Subtext: apartamentos */}
    <text x="140" y="105" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="400" fontSize="10" fill="#1B2E3C" letterSpacing="0.8em" opacity="0.6">APARTAMENTOS</text>
    
    {/* Subtext: ETAPA III */}
    <text x="140" y="125" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="14" fill="#1B2E3C">ETAPA III</text>
  </svg>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepreneurships, setEntrepreneurships] = useState<Entrepreneurship[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'resident' | 'admin'>('resident');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth & Admin Bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        if (u.email === ADMIN_EMAIL) {
          setIsAdmin(true);
          setActiveTab('admin'); // Auto switch for the primary admin
          // Asegurar que el documento admin existe
          try {
            const adminDocRef = doc(db, 'admins', u.uid);
            const adminDoc = await getDoc(adminDocRef);
            if (!adminDoc.exists()) {
              await setDoc(adminDocRef, { email: u.email, role: 'superadmin' });
            }
          } catch (e) {
            console.error("Error bootstrapping admin doc", e);
          }
        } else {
          // Verificar si es admin por DB
          try {
            const adminDoc = await getDoc(doc(db, 'admins', u.uid));
            const isAdm = adminDoc.exists();
            setIsAdmin(isAdm);
            if (isAdm) setActiveTab('admin');
          } catch (e) {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
        setActiveTab('resident');
      }
    });
    return unsubscribe;
  }, []);

  // Sync Entrepreneurships
  useEffect(() => {
    let q;
    if (isAdmin && activeTab === 'admin') {
      q = query(collection(db, 'entrepreneurships'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'entrepreneurships'), 
        where('status', '==', EntrepreneurshipStatus.APPROVED),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entrepreneurship));
      setEntrepreneurships(data);
      setLoading(false);
    }, (error) => {
      // Silece list errors if we don't have indexes yet
      if (error.code === 'failed-precondition') {
        console.warn("Index needed for this query");
      }
    });

    return unsubscribe;
  }, [isAdmin, activeTab]);

  // Sync Config
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'configs', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as AppConfig);
      } else if (isAdmin) {
        // Seed default config if admin is logged in and it doesn't exist
        const defaultConfig: AppConfig = {
          gateWhatsapp: "+57 310 7561169",
          adminWhatsapp: "+57 310 7561169",
          adminEmail: "Reservasdelpradoetapa3@gmail.com",
          adminHours: "Mar: 14:00-17:00 | Mie/Vie: 08:30-11:30, 14:00-17:00",
          paymentLinks: [
            { label: "Administración", url: "#" },
            { label: "Agua/Acueducto", url: "https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=13995" }
          ]
        };
        setDoc(doc(db, 'configs', 'main'), defaultConfig);
      }
    });
    return unsubscribe;
  }, [isAdmin]);

  const sanitizePhone = (phone: string | undefined | null) => {
    if (!phone) return "";
    return phone.replace(/\D/g, '');
  };

  const updateConfig = async (newConfig: AppConfig) => {
    try {
      await setDoc(doc(db, 'configs', 'main'), newConfig);
      alert('Configuración actualizada');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'configs/main');
    }
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      setErrorMsg("Error al iniciar sesión. Por favor intenta de nuevo.");
    }
  };

  const logout = () => auth.signOut();

  const handleApprove = async (id: string, status: EntrepreneurshipStatus) => {
    try {
      await updateDoc(doc(db, 'entrepreneurships', id), { 
        status, 
        updatedAt: serverTimestamp() 
      });
    } catch (e) {
      setErrorMsg("Error al actualizar la solicitud.");
      handleFirestoreError(e, OperationType.UPDATE, `entrepreneurships/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setErrorMsg(null);
      await deleteDoc(doc(db, 'entrepreneurships', id));
    } catch (e) {
      setErrorMsg("Error al eliminar. Puede que no tengas permisos suficientes.");
      handleFirestoreError(e, OperationType.DELETE, `entrepreneurships/${id}`);
    }
  };

  const filteredItems = entrepreneurships.filter(item => {
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#2d2d2d] font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e1da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Logo className="h-12 w-auto" />
            </div>

            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setActiveTab('resident')}
                className={cn(
                  "text-sm font-medium transition-colors",
                  activeTab === 'resident' ? "text-[#5a5a40]" : "text-gray-500 hover:text-[#5a5a40]"
                )}
              >
                Emprendimientos
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium transition-colors",
                    activeTab === 'admin' ? "text-[#5a5a40]" : "text-gray-500 hover:text-[#5a5a40]"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Panel Admin
                </button>
              )}
              <div className="h-4 w-[1px] bg-gray-200"></div>
              {user ? (
                <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
                  <button onClick={logout} className="text-gray-500 hover:text-red-500">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={login} className="text-sm font-semibold bg-[#2d2d2d] text-white px-4 py-2 rounded-full hover:bg-black transition-all">
                  Acceso Admin
                </button>
              )}
            </div>

            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-[#2d2d2d]"
              >
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 w-full bg-white border-b border-[#e5e1da] z-40 p-4 drop-shadow-xl"
          >
            <div className="flex flex-col gap-4">
              <button onClick={() => { setActiveTab('resident'); setIsMenuOpen(false); }} className="text-left font-medium p-2">Comunidad</button>
              {isAdmin && (
                <button onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); }} className="text-left font-medium p-2 text-[#5a5a40]">Admin Panel</button>
              )}
              {user ? (
                <button onClick={logout} className="text-left font-medium p-2 text-red-500">Salir</button>
              ) : (
                <button onClick={login} className="text-left font-medium p-2">Login</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'resident' ? (
          <>
            <div className="mb-12">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-5xl md:text-7xl font-serif font-light mb-6 leading-tight text-brand-blue"
                  >
                    El talento vive <br /> en <span className="font-bold italic text-brand-green">nuestra reserva.</span>
                  </motion.h2>
                  <p className="text-lg text-gray-600 mb-8 max-w-md">
                    Descubre y apoya los emprendimientos de tus vecinos en <b>San Antonio de Prado</b>. Fortalezcamos juntos nuestra Etapa III.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-brand-green text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-[#6DA515] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Inscribir mi Negocio
                    </button>
                    <a 
                      href={config?.gateWhatsapp ? `https://wa.me/${sanitizePhone(config.gateWhatsapp)}` : `https://wa.me/573107561169`} 
                      target="_blank"
                      className="bg-white border border-[#e5e1da] text-[#2d2d2d] px-8 py-4 rounded-full font-medium flex items-center gap-2 hover:bg-gray-50 transition-all"
                    >
                      <Phone className="w-5 h-5" />
                      Contacto Portería
                    </a>
                  </div>
                </div>
                <div className="relative">
                  <div className="aspect-[4/3] rounded-[3rem] overflow-hidden rotate-2 shadow-2xl bg-gray-200">
                    <img 
                      src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop" 
                      alt="Local store" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <div className="bg-white p-6 rounded-3xl border border-[#e5e1da] flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green-light rounded-2xl flex items-center justify-center text-brand-green">
                  <Phone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Contacto Portería</p>
                  <a 
                    href={config?.gateWhatsapp ? `https://wa.me/${sanitizePhone(config.gateWhatsapp)}` : `https://wa.me/573107561169`} 
                    target="_blank"
                    className="font-bold text-brand-blue hover:underline block"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-[#e5e1da] flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green-light rounded-2xl flex items-center justify-center text-brand-green">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Contacto Admin</p>
                  <p className="font-bold text-brand-blue text-xs break-all mt-1">{config?.adminEmail || 'Reservasdelpradoetapa3@gmail.com'}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-[#e5e1da] flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green-light rounded-2xl flex items-center justify-center text-brand-green">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Horarios Admin</p>
                  <p className="text-[10px] font-bold text-brand-blue leading-tight mt-1">
                    Mar: 14:00-17:00<br />
                    Mié/Vie: 08:30-11:30 & 14:00-17:00
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-[#e5e1da] flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green-light rounded-2xl flex items-center justify-center text-brand-green">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Pagos PSE</p>
                  <div className="flex flex-col gap-2 mt-2">
                    {(config?.paymentLinks || [
                      { label: "Administración", url: "#" },
                      { label: "Agua/Acueducto", url: "https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=13995" }
                    ]).map((link, i) => (
                      <a 
                        key={i} 
                        href={link.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full text-[10px] font-bold text-center bg-brand-blue text-white py-2 px-3 rounded-xl hover:shadow-md hover:brightness-110 transition-all active:scale-95"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
                <button 
                  onClick={() => setSelectedCategory('Todos')}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    selectedCategory === 'Todos' ? "bg-brand-blue text-white" : "bg-white border border-[#e5e1da] text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Todos
                </button>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                      selectedCategory === cat ? "bg-brand-blue text-white" : "bg-white border border-[#e5e1da] text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar emprendimientos..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#e5e1da] rounded-2xl focus:ring-2 focus:ring-[#5a5a40] outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5a5a40]"></div>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredItems.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group bg-white rounded-[2rem] overflow-hidden border border-[#e5e1da] hover:shadow-2xl transition-all duration-500"
                  >
                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                      <img 
                        src={item.images[0]} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-green bg-brand-green-light px-2 py-1 rounded">
                          {item.category}
                        </span>
                        <span className="text-xs text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">Casa/Apto {item.unitNumber}</span>
                      </div>
                      <h3 className="text-2xl font-bold mb-3 text-brand-blue">{item.name}</h3>
                      <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between pt-6 border-t border-[#f0eee9]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-green-light flex items-center justify-center text-brand-green font-bold text-[10px]">
                            {item.residentName.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-brand-blue">{item.residentName}</span>
                        </div>
                        <a 
                          href={`https://wa.me/${sanitizePhone(item.whatsapp)}?text=Hola! Vi tu negocio ${item.name} en la plataforma de Reserva del Prado III.`}
                          target="_blank"
                          className="w-12 h-12 rounded-full border-2 border-brand-green flex items-center justify-center text-brand-green hover:bg-brand-green hover:text-white transition-all shadow-md active:scale-95"
                        >
                          <Phone className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-[#e5e1da]">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-500">No se encontraron resultados</h3>
                <p className="text-gray-400">Intenta con otra categoría o término de búsqueda.</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-8">
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center justify-between animate-pulse">
                <p className="text-sm font-medium">{errorMsg}</p>
                <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <header className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12">
              <div>
                <h2 className="text-4xl font-bold mb-2">Gestión de Contenido</h2>
                <p className="text-gray-500">Revisa y aprueba solicitudes de residentes.</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white border border-[#e5e1da] px-6 py-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-bold">{entrepreneurships.length}</p>
                </div>
                <div className="bg-white border border-[#e5e1da] px-6 py-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Pendientes</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {entrepreneurships.filter(e => e.status === EntrepreneurshipStatus.PENDING).length}
                  </p>
                </div>
              </div>
            </header>

            {/* Config Form for Admin */}
            <div className="bg-brand-blue text-white rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 italic serif">Ajustes - Reserva del Prado III</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateConfig({
                  gateWhatsapp: formData.get('gateWhatsapp') as string,
                  adminWhatsapp: '', // Removed per request
                  adminEmail: formData.get('adminEmail') as string,
                  adminHours: formData.get('adminHours') as string,
                  paymentLinks: [
                    { label: "Administración", url: "#" },
                    { label: "Agua/Acueducto", url: formData.get('waterLink') as string }
                  ]
                });
              }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-2 block">WhatsApp Portería</label>
                  <input name="gateWhatsapp" defaultValue={config?.gateWhatsapp} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-2 block">Email Admin</label>
                  <input name="adminEmail" defaultValue={config?.adminEmail} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-2 block">Horarios Admin</label>
                  <input name="adminHours" defaultValue={config?.adminHours} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-green" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-2 block">Link Agua (PSE)</label>
                  <input 
                    name="waterLink" 
                    defaultValue={config?.paymentLinks?.find(l => l.label === "Agua/Acueducto")?.url || "https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=13995"} 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-green" 
                  />
                </div>
                <button type="submit" className="bg-brand-green text-white font-bold py-3 px-6 rounded-xl hover:brightness-110 transition-all">
                  Guardar Cambios
                </button>
              </form>
            </div>

            <div className="grid gap-6">
              {entrepreneurships.map(item => (
                <div key={item.id} className="bg-white border border-[#e5e1da] rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-full md:w-48 h-32 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
                    <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-bold">{item.name}</h4>
                      <div className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                        item.status === EntrepreneurshipStatus.APPROVED ? "bg-green-100 text-green-700" :
                        item.status === EntrepreneurshipStatus.REJECTED ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {item.status}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Store className="w-3 h-3"/> {item.category}</span>
                      <span className="flex items-center gap-1"><Info className="w-3 h-3"/> {item.unitNumber}</span>
                    </div>
                  </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      {item.status !== EntrepreneurshipStatus.APPROVED && (
                        <button 
                          onClick={() => handleApprove(item.id, EntrepreneurshipStatus.APPROVED)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Aprobar
                        </button>
                      )}
                      {item.status !== EntrepreneurshipStatus.REJECTED && (
                        <button 
                          onClick={() => handleApprove(item.id, EntrepreneurshipStatus.REJECTED)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-50 text-amber-600 border border-amber-100 px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 px-4 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                        title="Eliminar solicitud"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="absolute top-6 right-6 z-10">
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid md:grid-cols-5">
                <div className="md:col-span-2 bg-brand-blue p-10 text-white flex flex-col justify-between hidden md:flex">
                  <div>
                    <Store className="w-12 h-12 mb-6" />
                    <h3 className="text-3xl font-bold mb-4 italic serif">Tu talento en la reserva.</h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      Llega a tus vecinos de <b>Etapa III</b> de forma fácil. Completa el formulario y sé parte de nuestra vitrina comunitaria.
                    </p>
                  </div>
                </div>
                
                <div className="md:col-span-3 p-8 sm:p-12 overflow-y-auto max-h-[90vh]">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const docData = {
                      name: formData.get('name') as string,
                      description: formData.get('description') as string,
                      category: formData.get('category') as string,
                      whatsapp: formData.get('whatsapp') as string,
                      residentName: formData.get('residentName') as string,
                      unitNumber: formData.get('unitNumber') as string,
                      images: [formData.get('imageUrl') as string || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop'],
                      status: EntrepreneurshipStatus.PENDING,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    };
                    try {
                      await addDoc(collection(db, 'entrepreneurships'), docData);
                      setIsModalOpen(false);
                      setSearchTerm(""); // Reset search or something to show the new item?
                    } catch (e) {
                      setErrorMsg("No se pudo enviar la solicitud. Revisa tu conexión.");
                      handleFirestoreError(e, OperationType.CREATE, 'entrepreneurships');
                    }
                  }} className="space-y-5">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Nombre del Negocio</label>
                      <input name="name" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Categoría</label>
                        <select name="category" className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">WhatsApp</label>
                        <input name="whatsapp" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Descripción</label>
                      <textarea name="description" required rows={3} className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Responsable</label>
                        <input name="residentName" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Apto / Casa</label>
                        <input name="unitNumber" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">URL Imagen</label>
                      <input name="imageUrl" className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-brand-green text-white py-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg">
                      Enviar Solicitud
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-20 border-t border-[#e5e1da] bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center">
          <Logo className="h-16 w-auto mb-6 opacity-80" />
          <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4 font-medium italic">
            "Donde el talento local florece en armonía."
          </p>
          <div className="h-[1px] w-20 bg-brand-green/20 mb-4"></div>
          <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">San Antonio de Prado, Medellín</p>
        </div>
      </footer>
    </div>
  );
}
