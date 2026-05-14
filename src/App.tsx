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
  Trash2,
  Instagram,
  Video,
  Bell,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import { Entrepreneurship, EntrepreneurshipStatus, AppConfig, OperationType, Announcement, AnnouncementStatus } from './types';
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'resident' | 'admin'>('resident');
  const [adminTab, setAdminTab] = useState<'entrepreneurships' | 'announcements' | 'config'>('entrepreneurships');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Sync Announcements
  useEffect(() => {
    let q;
    if (isAdmin && activeTab === 'admin') {
      q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'announcements'), 
        where('status', '==', AnnouncementStatus.APPROVED),
        where('expiresAt', '>', new Date()),
        orderBy('expiresAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    }, (error) => {
      console.error("Announcements error:", error);
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

  const formatInstagramUrl = (instagram: string | undefined | null) => {
    if (!instagram) return "";
    const clean = instagram.trim();
    if (clean.startsWith('http')) return clean;
    const handle = clean.startsWith('@') ? clean.substring(1) : clean;
    return `https://instagram.com/${handle}`;
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
      setErrorMsg(null);
      const provider = new GoogleAuthProvider();
      // Forzar selección de cuenta para evitar cierres automáticos si hay una sesión previa
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      console.log("Login successful:", result.user.email);
    } catch (e: any) {
      console.error("Login error details:", e);
      let errorText = "Error al iniciar sesión.";
      
      if (e.code === 'auth/unauthorized-domain') {
        errorText = "DOMINIO NO AUTORIZADO: Debes añadir 'reserva-del-prado-iii.vercel.app' en la Consola de Firebase (Authentication > Settings > Authorized domains).";
      } else if (e.code === 'auth/popup-closed-by-user') {
        errorText = "La ventana se cerró. Por favor, completa el proceso de inicio de sesión sin cerrar la ventana.";
      } else if (e.code === 'auth/cancelled-popup-request') {
        errorText = "Se canceló la solicitud de inicio de sesión.";
      } else {
        errorText = `Error: ${e.message || "Error desconocido en Firebase"}`;
      }
      
      setErrorMsg(errorText);
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
        {errorMsg && (
          <div className="mb-8 bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center justify-between shadow-sm">
            <p className="text-sm font-medium">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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

            {/* Sección de Anuncios */}
            <div className="mb-16">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2 text-brand-blue">
                    <Megaphone className="text-brand-green w-6 h-6" />
                    Anuncios de la Comunidad
                  </h3>
                  <p className="text-gray-500 text-sm">Avisos importantes y novedades de tus vecinos (vigencia 7 días)</p>
                </div>
                <button 
                  onClick={() => setIsAnnouncementModalOpen(true)}
                  className="bg-brand-blue text-white px-6 py-3 rounded-full text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 whitespace-nowrap"
                >
                  <Bell className="w-4 h-4" />
                  Publicar Anuncio
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-[2.5rem] p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4 shadow-sm">
                    <Bell className="w-8 h-8" />
                  </div>
                  <p className="text-gray-500 font-medium">No hay anuncios activos en este momento.</p>
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
                  {announcements.map((ann) => (
                    <motion.div 
                      key={ann.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="min-w-[280px] md:min-w-[320px] bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-all"
                    >
                      <div className="aspect-square relative overflow-hidden bg-gray-100">
                        {ann.mediaType === 'video' ? (
                          <video 
                            src={ann.mediaUrl} 
                            className="w-full h-full object-cover"
                            controls={false}
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          <img 
                            src={ann.mediaUrl} 
                            alt={ann.description}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-bold text-brand-blue shadow-sm">
                          Residente {ann.unitNumber}
                        </div>
                        {ann.mediaType === 'video' && (
                          <div className="absolute top-4 right-4 bg-black/40 p-2 rounded-full text-white backdrop-blur-sm">
                            <Video className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <p className="text-sm text-gray-700 font-medium line-clamp-3 mb-6 leading-relaxed">
                          {ann.description}
                        </p>
                        <div className="flex items-center justify-between border-t border-gray-50 pt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          <span className="text-brand-green">{ann.residentName}</span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {ann.expiresAt?.toDate ? ann.expiresAt.toDate().toLocaleDateString() : 'Activo'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
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
                        <div className="flex items-center gap-2">
                          {item.instagram && (
                            <a 
                              href={formatInstagramUrl(item.instagram)}
                              target="_blank"
                              rel="noreferrer"
                              className="w-10 h-10 rounded-full border border-pink-100 flex items-center justify-center text-pink-500 hover:bg-pink-500 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Instagram"
                            >
                              <Instagram className="w-5 h-5" />
                            </a>
                          )}
                          <a 
                            href={`https://wa.me/${sanitizePhone(item.whatsapp)}?text=Hola! Vi tu negocio ${item.name} en la plataforma de Reserva del Prado III.`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-10 h-10 rounded-full border border-green-100 flex items-center justify-center text-brand-green hover:bg-brand-green hover:text-white transition-all shadow-sm active:scale-95"
                            title="WhatsApp"
                          >
                            <Phone className="w-5 h-5" />
                          </a>
                        </div>
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
            <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-12">
              <div>
                <h2 className="text-4xl font-bold mb-2 text-brand-blue">Gestión de Contenido</h2>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-brand-green" />
                  <span className="text-sm font-medium italic">Panel Administrativo</span>
                </div>
              </div>
              
              <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner">
                <button 
                  onClick={() => setAdminTab('entrepreneurships')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    adminTab === 'entrepreneurships' ? "bg-white text-brand-blue shadow-md" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Store className="w-4 h-4" />
                  Negocios ({entrepreneurships.length})
                </button>
                <button 
                  onClick={() => setAdminTab('announcements')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    adminTab === 'announcements' ? "bg-white text-brand-blue shadow-md" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Megaphone className="w-4 h-4" />
                  Anuncios ({announcements.length})
                </button>
                <button 
                  onClick={() => setAdminTab('config')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    adminTab === 'config' ? "bg-white text-brand-blue shadow-md" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Ajustes
                </button>
              </div>
            </header>

            {adminTab === 'config' && (
              <div className="bg-brand-blue text-white rounded-[2.5rem] p-8 md:p-12 mb-12 shadow-2xl">
                <h3 className="text-2xl font-bold mb-6 italic serif text-brand-green">Ajustes - Reserva del Prado III</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateConfig({
                    gateWhatsapp: formData.get('gateWhatsapp') as string,
                    adminWhatsapp: '', 
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
                  <div className="md:col-span-2">
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
            )}

            {adminTab === 'entrepreneurships' && (
              <div className="grid gap-6">
                {entrepreneurships.map(item => (
                  <div key={item.id} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow-xl transition-all">
                    <div className="w-full md:w-48 h-32 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
                      <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-xl font-bold text-brand-blue">{item.name}</h4>
                        <div className={cn(
                          "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                          item.status === EntrepreneurshipStatus.APPROVED ? "bg-green-100 text-green-700" :
                          item.status === EntrepreneurshipStatus.REJECTED ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {item.status}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 italic italic italic italic italic italic">"{item.description}"</p>
                      <div className="flex gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-brand-green"/> {item.category}</span>
                        <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-brand-blue"/> Residente {item.unitNumber}</span>
                      </div>
                    </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        {item.status !== EntrepreneurshipStatus.APPROVED && (
                          <button 
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'entrepreneurships', item.id), { 
                                  status: EntrepreneurshipStatus.APPROVED,
                                  updatedAt: serverTimestamp()
                                });
                              } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'entrepreneurships'); }
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-green text-white px-6 py-3 rounded-2xl font-bold text-xs hover:brightness-110 shadow-md transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Aprobar
                          </button>
                        )}
                        <button 
                          onClick={async () => {
                            if (confirm("¿Seguro que quieres eliminar este negocio?")) {
                              try {
                                await deleteDoc(doc(db, 'entrepreneurships', item.id));
                              } catch (err) { handleFirestoreError(err, OperationType.DELETE, 'entrepreneurships'); }
                            }
                          }}
                          className="w-14 h-14 rounded-2xl border border-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all active:scale-95"
                          title="Eliminar solicitud"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'announcements' && (
              <div className="grid gap-6">
                {announcements.map(ann => (
                  <div key={ann.id} className="bg-white border border-gray-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow-xl transition-all">
                    <div className="w-full md:w-48 h-32 rounded-2xl bg-gray-100 overflow-hidden shrink-0 relative">
                      {ann.mediaType === 'video' ? (
                         <video src={ann.mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                         <img src={ann.mediaUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm p-1 rounded-lg text-white">
                        {ann.mediaType === 'video' ? <Video className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                      </div>
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                          ann.status === AnnouncementStatus.APPROVED ? "bg-green-100 text-green-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          Anuncio {ann.status}
                        </div>
                        <span className="text-xs text-gray-400 font-bold">Vence: {ann.expiresAt?.toDate?.() ? ann.expiresAt.toDate().toLocaleDateString() : 'Pendiente'}</span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1 italic italic">"{ann.description}"</p>
                      <div className="flex gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5 text-brand-green"/> {ann.residentName}</span>
                        <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-brand-blue"/> Apto {ann.unitNumber}</span>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      {ann.status !== AnnouncementStatus.APPROVED && (
                        <button 
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'announcements', ann.id), { status: AnnouncementStatus.APPROVED });
                            } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'announcements'); }
                          }}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-green text-white px-6 py-3 rounded-2xl font-bold text-xs hover:brightness-110 shadow-md transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Aprobar
                        </button>
                      )}
                      <button 
                        onClick={async () => {
                          if (confirm("¿Eliminar este anuncio?")) {
                            try {
                              await deleteDoc(doc(db, 'announcements', ann.id));
                            } catch (err) { handleFirestoreError(err, OperationType.DELETE, 'announcements'); }
                          }
                        }}
                        className="w-14 h-14 rounded-2xl border border-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all active:scale-95"
                        title="Eliminar anuncio"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    setErrorMsg(null);
                    
                    const formData = new FormData(e.currentTarget);
                    
                    let finalImage = formData.get('imageUrl') as string;
                    const fileInput = (e.currentTarget.elements.namedItem('imageFile') as HTMLInputElement);
                    
                    if (fileInput?.files && fileInput.files[0]) {
                      const file = fileInput.files[0];
                      try {
                        const reader = new FileReader();
                        const rawImage: string = await new Promise((resolve, reject) => {
                          reader.onload = () => resolve(reader.result as string);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        });

                        // Resize image to ensure it's within Firestore limits
                        finalImage = await new Promise((resolve) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const max_size = 1200; // Max dimension

                            if (width > height) {
                              if (width > max_size) {
                                height *= max_size / width;
                                width = max_size;
                              }
                            } else {
                              if (height > max_size) {
                                width *= max_size / height;
                                height = max_size;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality
                          };
                          img.src = rawImage;
                        });
                      } catch (err) {
                        console.error("Error processing image:", err);
                        setErrorMsg("Error al procesar la imagen. Intenta con otra.");
                        setIsSubmitting(false);
                        return;
                      }
                    }

                    const docData = {
                      name: formData.get('name') as string,
                      description: formData.get('description') as string,
                      category: formData.get('category') as string,
                      whatsapp: sanitizePhone(formData.get('whatsapp') as string),
                      instagram: formData.get('instagram') as string || "",
                      residentName: formData.get('residentName') as string,
                      unitNumber: formData.get('unitNumber') as string,
                      images: [finalImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop'],
                      status: EntrepreneurshipStatus.PENDING,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    };
                    try {
                      await addDoc(collection(db, 'entrepreneurships'), docData);
                      setIsModalOpen(false);
                      setSearchTerm("");
                      alert("¡Solicitud enviada con éxito! Estará visible una vez sea aprobada por administración.");
                    } catch (e: any) {
                      console.error("Upload error:", e);
                      let msg = "No se pudo enviar la solicitud.";
                      if (e.message?.includes('too large')) {
                        msg = "La imagen es demasiado grande. Por favor intenta con una más pequeña o usa un link.";
                      } else if (e.code === 'permission-denied') {
                        msg = "Error de permisos. Revisa que todos los campos obligatorios estén llenos correctamente.";
                      }
                      setErrorMsg(msg);
                      handleFirestoreError(e, OperationType.CREATE, 'entrepreneurships');
                    } finally {
                      setIsSubmitting(false);
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
                        <input name="whatsapp" required placeholder="Ej: 300 123 4567" className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block text-brand-green">Instagram (Opcional)</label>
                      <input name="instagram" placeholder="Ej: @tu_negocio o link" className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:border-brand-green/30 outline-none" />
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
                    <div className="pt-2">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3 block">Imagen del Negocio</label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Camera className="w-8 h-8 text-gray-400 mb-2" />
                              <p className="text-xs text-gray-500 font-medium">Subir desde galería o equipo</p>
                            </div>
                            <input name="imageFile" type="file" accept="image/*" className="hidden" />
                          </label>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-[10px] font-bold text-gray-400">O URL:</span>
                          </div>
                          <input name="imageUrl" placeholder="https://..." className="w-full pl-16 pr-5 py-2 text-xs rounded-xl bg-gray-50 border border-gray-100 outline-none italic" />
                        </div>
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-brand-green text-white py-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar para Revisión"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal para Publicar Anuncio */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAnnouncementModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-brand-blue">Publicar Anuncio</h3>
                  <button onClick={() => setIsAnnouncementModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X />
                  </button>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (isSubmitting) return;
                  setIsSubmitting(true);
                  setErrorMsg(null);

                  const formData = new FormData(e.currentTarget);
                  const fileInput = (e.currentTarget.elements.namedItem('annMediaFile') as HTMLInputElement);
                  
                  let finalMediaUrl = "";
                  let mediaType: 'image' | 'video' = 'image';

                  const file = fileInput?.files?.[0];
                  if (file) {
                    if (file.type.startsWith('video/')) mediaType = 'video';
                    
                    const reader = new FileReader();
                    const rawMedia: string = await new Promise((resolve, reject) => {
                      reader.onload = () => resolve(reader.result as string);
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });

                    if (mediaType === 'image') {
                      // Resize and compress image
                      finalMediaUrl = await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let width = img.width;
                          let height = img.height;
                          const max_size = 1200;

                          if (width > height) {
                            if (width > max_size) {
                              height *= max_size / width;
                              width = max_size;
                            }
                          } else {
                            if (height > max_size) {
                              width *= max_size / height;
                              height = max_size;
                            }
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx?.drawImage(img, 0, 0, width, height);
                          resolve(canvas.toDataURL('image/jpeg', 0.6));
                        };
                        img.src = rawMedia;
                      });
                    } else {
                      // For video, we just use base64 (not ideal for large videos, but okay for a demo prototype)
                      finalMediaUrl = rawMedia;
                      if (finalMediaUrl.length > 2000000) { 
                         setErrorMsg("El video o imagen es demasiado grande. Intenta con un archivo más pequeño.");
                         setIsSubmitting(false);
                         return;
                      }
                    }
                  } else {
                    setErrorMsg("Debes subir una foto o video.");
                    setIsSubmitting(false);
                    return;
                  }

                  const now = new Date();
                  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                  const annData = {
                    description: formData.get('description') as string,
                    mediaUrl: finalMediaUrl,
                    mediaType,
                    residentName: formData.get('residentName') as string,
                    unitNumber: formData.get('unitNumber') as string,
                    status: AnnouncementStatus.PENDING,
                    createdAt: serverTimestamp(),
                    expiresAt: sevenDaysLater
                  };

                  try {
                    await addDoc(collection(db, 'announcements'), annData);
                    setIsAnnouncementModalOpen(false);
                    alert("¡Anuncio enviado! Será publicado luego de ser aprobado por administración.");
                  } catch (e: any) {
                    console.error("Ann error:", e);
                    setErrorMsg("No se pudo enviar el anuncio. El archivo es probablemente demasiado grande para el sistema.");
                    handleFirestoreError(e, OperationType.CREATE, 'announcements');
                  } finally {
                    setIsSubmitting(false);
                  }
                }} className="space-y-5">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Descripción del Anuncio</label>
                    <textarea name="description" required rows={3} placeholder="¿Qué quieres anunciar?" className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none resize-none focus:bg-white" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Tu Nombre</label>
                      <input name="residentName" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">Torre/Apartamento</label>
                      <input name="unitNumber" required className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">Foto o Video (Máximo 1MB)</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-xs text-gray-500 font-medium">Click para subir foto o video</p>
                        <p className="text-[9px] text-gray-400 mt-1 italic">Vigencia: 7 días desde hoy</p>
                      </div>
                      <input name="annMediaFile" type="file" accept="image/*,video/*" className="hidden" required />
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</> : "Publicar para Revisión"}
                  </button>
                </form>
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
