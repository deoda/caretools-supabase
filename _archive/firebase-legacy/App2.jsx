import { supabase } from './supabase'
import { jsPDF } from 'jspdf'

import { useEffect, useMemo, useState } from 'react'
import './App.css'

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  runTransaction,
  query,
  where,
} from 'firebase/firestore'

import { db, auth, adminInviteAuth } from './firebase/firebase'
import { getApp } from 'firebase/app'

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'

supabase
  .from('products')
  .select('*')
  .then(({ data, error }) => {
    if (error) {
      console.log('SUPABASE ERREUR :', error)
    } else {
      console.log('SUPABASE CONNECTÉ :', data)
    }
  })

const ADMIN_EMAIL = 'madeodat@gmail.com'

const storage = getStorage(getApp())


const initialProducts = [
  {
    id: 1,
    name: 'Classic T-Shirt',
    description:
      'Comfortable cotton T-shirt designed for everyday wear. Perfect for casual activities and everyday use.',
    price: 29.99,
    category: 'Clothing',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    ],
    video: '',
    stock: 20,
    badge: 'Best Seller',
    status: 'active',
    createdAt: '2026-08-21',
  },
  {
    id: 2,
    name: 'Running Shoes',
    description:
      'Comfortable and lightweight running shoes suitable for daily activities, walking and exercise.',
    price: 79.99,
    category: 'Shoes',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    ],
    video: '',
    stock: 15,
    badge: 'Popular',
    status: 'active',
    createdAt: '2026-08-21',
  },
  {
    id: 3,
    name: 'Leather Bag',
    description:
      'Stylish and practical leather bag suitable for everyday use, work and travel.',
    price: 59.99,
    category: 'Accessories',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    ],
    video: '',
    stock: 10,
    badge: 'New',
    status: 'active',
    createdAt: '2026-08-21',
  },
]

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  category: '',
  subcategory: '',
  image: '',
  video: '',
  stock: '',
  badge: '',
  productCode: '',
  size: '',
  status: 'active',
}

const orderStatuses = [
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
]

const loadData = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

const formatPrice = (price) => {
  if (price === null || price === '' || price === undefined) {
    return ''
  }

  return `${Math.round(Number(price) || 0).toLocaleString('fr-FR')} FRW`
}

function App() {
  // =========================
  // NAVIGATION
  // =========================

  const [activePage, setActivePage] = useState('home')
  const [selectedProduct, setSelectedProduct] = useState(null)

  // ADMIN AUTHENTICATION
  const [adminUser, setAdminUser] = useState(null)
  const [clientUser, setClientUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [clientAuthMode, setClientAuthMode] = useState('login')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPassword, setClientPassword] = useState('')
  const [clientAuthLoading, setClientAuthLoading] = useState(false)
  const [clientAuthError, setClientAuthError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [adminLoginError, setAdminLoginError] = useState('')

  useEffect(() => {

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {

      if (!user) {
        setAdminUser(null)
        setClientUser(null)
        setAuthLoading(false)
        return
      }

      try {

  const userRef = doc(
  db,
  'admins',
  user.uid
)

        const userSnapshot = await getDoc(userRef)

        if (
          userSnapshot.exists() &&
          userSnapshot.data().status === 'active' &&
          (
            userSnapshot.data().role === 'superadmin' ||
            userSnapshot.data().role === 'admin'
          )
        ) {

          setAdminUser({
            ...user,
            ...userSnapshot.data(),
          })
          setClientUser(null)

        } else {

          setAdminUser(null)
          setClientUser(user)

        }

      } catch (error) {

        console.error(
          'Error checking admin role:',
          error
        )

        setAdminUser(null)

      } finally {

        setAuthLoading(false)

      }

    }
  )

  return unsubscribe

}, [])

  const handleAdminLogin = async (event) => {
    event.preventDefault()
    setAdminLoginError('')
    
    try {
      setAdminLoginLoading(true)
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword)
      setAdminPassword('')
    } catch (error) {
      console.error('Admin login error:', error)
      setAdminLoginError('Incorrect email or password.')
    } finally {
      setAdminLoginLoading(false)
    }
  }

  const handleAdminLogout = async () => {
    try {
      await signOut(auth)
      setActivePage('home')
    } catch (error) {
      console.error('Admin logout error:', error)
      alert('Unable to log out. Please try again.')
    }
  }

  const handleClientAuth = async (event) => {
    event.preventDefault()
    setClientAuthError('')

    const email = clientEmail.trim().toLowerCase()
    const password = clientPassword

    if (!email || !password) return

    try {
      setClientAuthLoading(true)

      if (clientAuthMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }

      setClientPassword('')
      navigateTo('orders')
    } catch (error) {
      console.error('Client authentication error:', error)

      const messages = {
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/wrong-password': 'Incorrect email or password.',
        'auth/user-not-found': 'No account exists with this email address.',
        'auth/email-already-in-use': 'This email address is already registered.',
        'auth/weak-password': 'Password must contain at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      }

      setClientAuthError(
        messages[error?.code] ||
          error?.message ||
          'Unable to authenticate. Please try again.'
      )
    } finally {
      setClientAuthLoading(false)
    }
  }

  const handleClientLogout = async () => {
    try {
      await signOut(auth)
      setClientEmail('')
      setClientPassword('')
      setClientAuthError('')
      navigateTo('home')
    } catch (error) {
      console.error('Client logout error:', error)
      alert('Unable to log out. Please try again.')
    }
  }

  const requireClientLogin = () => {
    setClientAuthError('Please sign in or create a client account before viewing or placing orders.')
    navigateTo('account')
  }

  // =========================
  // PRODUCTS
  // =========================

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  // =========================
// CLIENT DISPLAY SETTINGS
// =========================

const [showPrices, setShowPrices] = useState(true)
const [showStockStatus, setShowStockStatus] = useState(true)

const loadDisplaySettings = async () => {
  try {
    const settingsRef = doc(db, 'settings', 'displaySettings')
    const settingsSnapshot = await getDoc(settingsRef)

    if (settingsSnapshot.exists()) {
      const data = settingsSnapshot.data()

      setShowPrices(
        data.showPrices !== false
      )

      setShowStockStatus(
        data.showStockStatus !== false
      )
    }
  } catch (error) {
    console.error(
      'Error loading display settings:',
      error
    )
  }
}

useEffect(() => {
  loadDisplaySettings()
}, [])

const saveDisplaySettings = async (nextShowPrices, nextShowStockStatus) => {
  try {
    await setDoc(
      doc(db, 'settings', 'displaySettings'),
      {
        showPrices: nextShowPrices,
        showStockStatus: nextShowStockStatus,
      },
      { merge: true }
    )

    setShowPrices(nextShowPrices)
    setShowStockStatus(nextShowStockStatus)
  } catch (error) {
    console.error('Error saving display settings:', error)
    alert(
      error?.message ||
        'Unable to save client display settings.'
    )
  }
}

const toggleShowPrices = async () => {
  await saveDisplaySettings(!showPrices, showStockStatus)
}

const toggleShowStockStatus = async () => {
  await saveDisplaySettings(showPrices, !showStockStatus)
}


    
const loadProducts = async () => {
  try {
    setProductsLoading(true)

    const { data, error } = await supabase
      .from('products')
      .select('*')

    if (error) {
      throw error
    }

    const supabaseProducts = (data || []).map((product) => ({
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      images: product.image ? [product.image] : [],
      video: product.video || '',
      stock: product.stock ?? '',
      badge: product.badge || '',
      productCode: product.product_code || '',
      size: product.size || '',
      status: product.status || 'active',
      createdAt: product.created_at || '',
    }))

    setProducts(supabaseProducts)
  } catch (error) {
    console.error('Error loading products from Supabase:', error)

    alert(
      'Unable to load products from Supabase. Check Supabase configuration and policies.'
    )
  } finally {
    setProductsLoading(false)
  }
}
  useEffect(() => {
    loadProducts()
  }, [])

  // =========================
  // CART
  // =========================

  const [cart, setCart] = useState(() =>
    loadData('exposhop-cart', [])
  )

  const [isCartOpen, setIsCartOpen] = useState(false)

  // =========================
  // ORDERS
  // =========================

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] =
    useState('All')

  const [adminOrderSearch, setAdminOrderSearch] =
    useState('')

  const [adminOrderStatusFilter, setAdminOrderStatusFilter] =
    useState('All')

  const [selectedAdminOrder, setSelectedAdminOrder] =
    useState(null)    

  const loadOrders = async () => {
    try {
      setOrdersLoading(true)

      const querySnapshot = await getDocs(
        collection(db, 'orders')
      )

      const firebaseOrders = querySnapshot.docs
        .map((document) => ({
          firebaseId: document.id,
          ...document.data(),
        }))
        .sort((a, b) => {
          const aTime = a.createdAt || 0
          const bTime = b.createdAt || 0
          return bTime - aTime
        })

      setOrders(firebaseOrders)
    } catch (error) {
      console.error('Error loading orders:', error)
      alert(
        'Unable to load orders from Firebase. Check Firebase configuration and Firestore rules.'
      )
    } finally {
      setOrdersLoading(false)
    }
  }

  const loadClientOrders = async () => {
    if (!clientUser) {
      setOrders([])
      setOrdersLoading(false)
      return
    }

    try {
      setOrdersLoading(true)

      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', clientUser.uid)
      )

      const querySnapshot = await getDocs(ordersQuery)

      const firebaseOrders = querySnapshot.docs
        .map((document) => ({
          firebaseId: document.id,
          ...document.data(),
        }))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))

      setOrders(firebaseOrders)
    } catch (error) {
      console.error('Error loading client orders:', error)
      alert('Unable to load your orders. Please check your connection and try again.')
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    if (adminUser) {
      loadOrders()
    } else if (clientUser) {
      loadClientOrders()
    } else {
      setOrders([])
      setOrdersLoading(false)
    }
  }, [adminUser, clientUser])

  // =========================
  // CUSTOMERS / USERS
  // =========================

  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')

  const normalizePhone = (phone) =>
    String(phone || '').replace(/[^0-9+]/g, '')

  const userDocumentId = (phone) =>
    normalizePhone(phone).replace(/\+/g, 'plus')

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, 'users')
      )

      setUsers(
        querySnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))
      )
    } catch (error) {
      console.error('Error loading users:', error)
      alert('Unable to load customers from Firebase.')
    }
  }

  useEffect(() => {
  if (adminUser) {
    loadUsers()
  } else {
    setUsers([])
  }
}, [adminUser])

  // =========================
  // SEARCH
  // =========================

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] =
    useState('All')

  // =========================
  // PRODUCT DETAIL
  // =========================

  const [selectedImage, setSelectedImage] = useState(0)
  const [detailQuantity, setDetailQuantity] = useState(1)

  // =========================
  // CHECKOUT
  // =========================

 const [isCheckoutOpen, setIsCheckoutOpen] =
  useState(false)

const [orderPlaced, setOrderPlaced] =
  useState(false)

const [placedCustomerName, setPlacedCustomerName] =
  useState('')

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    email: '',
  })

  useEffect(() => {
    if (clientUser?.email) {
      setCustomer((currentCustomer) => ({
        ...currentCustomer,
        email: currentCustomer.email || clientUser.email,
      }))
    }
  }, [clientUser])

  const [shipping, setShipping] =
    useState('standard')

  // =========================
  // ADMIN
  // =========================

  const [editingProduct, setEditingProduct] =
  useState(null)

const [adminForm, setAdminForm] =
  useState(emptyProduct)

  const [selectedImageFile, setSelectedImageFile] =
    useState(null)

  const [imageUploading, setImageUploading] =
    useState(false)

  const [imagePreviewUrl, setImagePreviewUrl] =
    useState('')

const [adminSection, setAdminSection] =
  useState('dashboard')

  const [showAdminMenu, setShowAdminMenu] =
    useState(false)

  // =========================
  // ADMIN INVITATION
  // =========================
  const [inviteAdminEmail, setInviteAdminEmail] = useState('')
  const [inviteAdminLoading, setInviteAdminLoading] = useState(false)
  const [inviteAdminMessage, setInviteAdminMessage] = useState('')

  const generateTemporaryPassword = () => {
    const random = Math.random().toString(36).slice(-10)
    return `Expo${random}9!`
  }

  const handleInviteAdmin = async (event) => {
    event.preventDefault()

    if (adminUser?.role !== 'superadmin') {
      alert('Only the Super Admin can invite another administrator.')
      return
    }

    const email = inviteAdminEmail.trim().toLowerCase()
    if (!email) return

    try {
      setInviteAdminLoading(true)
      setInviteAdminMessage('')

      const temporaryPassword = generateTemporaryPassword()
      const userCredential = await createUserWithEmailAndPassword(
        adminInviteAuth,
        email,
        temporaryPassword
      )

      const invitedUser = userCredential.user

      await setDoc(doc(db, 'admins', invitedUser.uid), {
        uid: invitedUser.uid,
        email,
        role: 'admin',
        status: 'active',
        invitedBy: adminUser.uid,
        invitedAt: Date.now(),
      })

      await sendPasswordResetEmail(adminInviteAuth, email)
      await signOut(adminInviteAuth)

      setInviteAdminEmail('')
      setInviteAdminMessage(
        `Invitation sent to ${email}. The administrator will receive a password-reset email before logging in.`
      )
    } catch (error) {
      console.error('Admin invitation error:', error)

      if (error?.code === 'auth/email-already-in-use') {
        setInviteAdminMessage('This email address is already registered in Firebase Authentication.')
      } else {
        setInviteAdminMessage(error?.message || 'Unable to invite the administrator.')
      }
    } finally {
      setInviteAdminLoading(false)
    }
  }

  // =========================
  // LOCAL STORAGE
  // =========================

  useEffect(() => {
    localStorage.setItem(
      'exposhop-cart',
      JSON.stringify(cart)
    )
  }, [cart])

  // =========================
  // CATEGORIES
  // =========================

  const subcategoriesByCategory = {
    Diagnostic: [
      'Stethoscopes',
      'Blood Pressure Monitors',
      'Thermometers',
      'Pulse Oximeters',
      'Otoscopes',
      'Glucometers',
      'ECG Machines',
      'Diagnostic Accessories',
      'Others',
    ],
    Surgery: [
      'Surgical Instruments',
      'Forceps',
      'Surgical Scissors',
      'Scalpels',
      'Retractors',
      'Needle Holders',
      'Surgical Sets',
      'Others',
    ],
    'Wound Care & Dressings': [
      'Gauze & Compresses',
      'Bandages',
      'Wound Dressings',
      'Adhesive Tapes',
      'Wound Care Sets',
      'Disinfectants',
      'Others',
    ],
    'Injection & Infusion': [
      'Syringes',
      'Needles',
      'Catheters',
      'IV Sets',
      'Infusion Tubing',
      'Infusion Accessories',
      'Others',
    ],
    Laboratory: [
      'Collection Tubes',
      'Microscopes',
      'Centrifuges',
      'Pipettes',
      'Rapid Tests',
      'Lab Consumables',
      'Others',
    ],
    Dental: [
      'Dental Instruments',
      'Dental Mirrors',
      'Dental Forceps',
      'Dental Burs',
      'Dental Equipment',
      'Dental Consumables',
      'Others',
    ],
    Orthopedics: [
      'Splints & Braces',
      'Wrist & Forearm',
      'Finger Splints',
      'Ankle Supports',
      'Thigh & Calf',
      'Knee Supports',
      'Neck Supports',
      'Back & Lumbar',
      'Compression & Varicose',
      'Neoprene Supports',
      'Orthopedic Belts',
      'Orthopedic Pillows',
      'Traction Kits',
      'Foot Care',
      'Walking Aids',
      'Physio & Rehab',
      'Others',
    ],
    'Maternity & Gynecology': [
      'Delivery Equipment',
      'Fetal Dopplers',
      'Gynecology Instruments',
      'Maternity Supplies',
      'Newborn Care',
      'Breastfeeding',
      'Pregnancy Care',
      'Others',
    ],
    Sterilization: [
      'Autoclaves',
      'Sterilizers',
      'Sterilization Pouches',
      'Sterilization Indicators',
      'Sterilization Accessories',
      'Others',
    ],
    'Medical Equipment': [
      'Patient Monitors',
      'Oxygen Concentrators',
      'Suction Machines',
      'Nebulizers',
      'ECG Machines',
      'Medical Pumps',
      'Others',
    ],
    'Medical Furniture': [
      'Hospital Beds',
      'Examination Tables',
      'Medical Chairs',
      'Medical Cabinets',
      'Medical Trolleys',
      'Stretchers',
      'Medical Stools',
      'Others',
    ],
    'Protection & Hygiene': [
      'Gloves',
      'Face Masks',
      'Medical Gowns',
      'Caps & Hair Covers',
      'Shoe Covers',
      'Disinfectants',
      'Others',
    ],
    'Medical Consumables': [
      'Gloves',
      'Gauze & Compresses',
      'Tubes',
      'Syringes',
      'Needles',
      'Medical Labels',
      'Others',
    ],
    'Emergency & First Aid': [
      'First Aid Kits',
      'Resuscitation Equipment',
      'Resuscitation Masks',
      'Emergency Blankets',
      'Emergency Splints',
      'Others',
    ],
  }

  const categories = useMemo(() => [
    'All',
    ...Object.keys(subcategoriesByCategory),
  ], [])

  // =========================
  // FILTERED PRODUCTS
  // =========================

  const filteredProducts = products.filter((product) => {
    const text = search.toLowerCase()

    const matchesSearch =
      product.name.toLowerCase().includes(text) ||
      product.category.toLowerCase().includes(text) ||
      (product.productCode || '').toLowerCase().includes(text) ||
      (product.size || '').toLowerCase().includes(text)

    const matchesCategory =
      selectedCategory === 'All' ||
      product.category === selectedCategory

    return (
      product.status === 'active' &&
      matchesSearch &&
      matchesCategory
    )
  })

  // =========================
  // FILTERED ORDERS
  // =========================

  const filteredOrders = orders.filter((order) => {
    const text = orderSearch.toLowerCase()

    const matchesSearch =
      order.id.toLowerCase().includes(text) ||
      order.customer?.name
        ?.toLowerCase()
        .includes(text) ||
      order.customer?.email
        ?.toLowerCase()
        .includes(text)

    const matchesStatus =
      orderStatusFilter === 'All' ||
      order.status === orderStatusFilter

    return matchesSearch && matchesStatus
  })

  const filteredAdminOrders = orders.filter((order) => {
    const text = adminOrderSearch.toLowerCase()

    const matchesSearch =
      order.id.toLowerCase().includes(text) ||
      order.customer?.name
        ?.toLowerCase()
        .includes(text) ||
      order.customer?.email
        ?.toLowerCase()
        .includes(text)

    const matchesStatus =
      adminOrderStatusFilter === 'All' ||
      order.status === adminOrderStatusFilter

    return matchesSearch && matchesStatus
  })

  // =========================
  // NAVIGATION
  // =========================

  const navigateTo = (page) => {
    setActivePage(page)
    setIsCartOpen(false)
    setShowAdminMenu(false)

    if (page !== 'product-detail') {
      setSelectedProduct(null)
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  // =========================
  // PRODUCT DETAIL
  // =========================

  const openProduct = (product) => {
    setSelectedProduct(product)
    setSelectedImage(0)
    setDetailQuantity(1)
    navigateTo('product-detail')
  }

  // =========================
  // CART
  // =========================

  const addToCart = (product, quantity = 1) => {
    if (!product || product.stock <= 0) return

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      )

      const quantityAlreadyInCart =
        existing?.quantity || 0

      const availableToAdd =
        product.stock - quantityAlreadyInCart

      if (availableToAdd <= 0) {
        return currentCart
      }

      const quantityToAdd = Math.min(
        quantity,
        availableToAdd
      )

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity + quantityToAdd,
                stock: product.stock,
              }
            : item
        )
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: Math.min(
            quantity,
            product.stock
          ),
        },
      ]
    })
  }

  const increaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        const currentProduct = products.find(
          (product) => product.id === id
        )

        const currentStock =
          currentProduct?.stock ?? item.stock

        return item.id === id
          ? {
              ...item,
              stock: currentStock,
              quantity: Math.min(
                item.quantity + 1,
                currentStock
              ),
            }
          : item
      })
    )
  }

  const decreaseQuantity = (id) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (id) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== id)
    )
  }

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  )

  // =========================
  // CHECKOUT
  // =========================

const shippingCost = 0

const finalTotal = cartTotal  

const handleCustomerChange = (event) => {
    const { name, value } = event.target

    setCustomer((currentCustomer) => ({
      ...currentCustomer,
      [name]: value,
    }))
  }

  const openCheckout = () => {
    if (!cart.length) return

    if (!clientUser) {
      requireClientLogin()
      return
    }

    // Final stock verification
    const stockProblem = cart.find((item) => {
      const product = products.find(
        (product) => product.id === item.id
      )

      return !product || item.quantity > product.stock
    })

    if (stockProblem) {
      alert(
        `Sorry, "${stockProblem.name}" no longer has enough stock available.`
      )
      return
    }

    setIsCartOpen(false)
    setIsCheckoutOpen(true)
  }

  const closeCheckout = () => {
    setIsCheckoutOpen(false)
    setOrderPlaced(false)
  }

const handlePlaceOrder = async (event) => {
  event.preventDefault()

  if (!cart.length) return

  const orderRef = doc(collection(db, 'orders'))
  const counterRef = doc(db, 'settings', 'orderCounter')
  const verifiedProducts = []

  try {
    const savedOrder = await runTransaction(
      db,
      async (transaction) => {

        // =========================
        // GENERATE SEQUENTIAL ORDER NUMBER
        // =========================
        const counterSnapshot = await transaction.get(
          counterRef
        )

        const lastNumber = counterSnapshot.exists()
          ? Number(counterSnapshot.data().lastNumber) || 1000
          : 1000

        const nextNumber = lastNumber + 1
        const orderNumber = `CT-${nextNumber}`

        for (const item of cart) {
          const { data: productData, error: productError } =
            await supabase
              .from('products')
              .select('*')
              .eq('id', item.id)
              .single()

          if (productError || !productData) {
            throw new Error(
              `${item.name} is no longer available.`
            )
          }

          if (item.quantity > productData.stock) {
            throw new Error(
              `${item.name} does not have enough stock.`
            )
          }

          verifiedProducts.push({
            data: productData,
            item,
          })
        }

        const newOrder = {
          id: orderNumber,
          date: new Date().toLocaleString(),
          createdAt: Date.now(),
          userId: clientUser?.uid || null,
          customer: { ...customer },
          items: cart.map((item) => ({ ...item })),
          subtotal: cartTotal,
          shipping: shippingCost,
          total: finalTotal,
          shippingMethod: shipping,
          status: 'Confirmed',
          stockRestored: false,
        }

        // Save the new counter value
        transaction.set(
          counterRef,
          {
            lastNumber: nextNumber,
          },
          { merge: true }
        )

        // Save the order
        transaction.set(orderRef, newOrder)

        return {
          firebaseId: orderRef.id,
          ...newOrder,
        }
      }
    )

    // =========================
    // UPDATE SUPABASE STOCK
    // =========================
    for (const { data, item } of verifiedProducts) {
      const newStock = Math.max(
        0,
        data.stock - item.quantity
      )

      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', data.id)

      if (stockError) {
        throw new Error(
          `Unable to update stock for ${item.name}.`
        )
      }
    }

    // =========================
    // UPDATE LOCAL PRODUCTS
    // =========================
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const orderedItem = cart.find(
          (item) => item.id === product.id
        )

        return orderedItem
          ? {
              ...product,
              stock: Math.max(
                0,
                product.stock - orderedItem.quantity
              ),
            }
          : product
      })
    )

    // =========================
    // ADD ORDER TO LOCAL STATE
    // =========================
    setOrders((currentOrders) => [
      savedOrder,
      ...currentOrders,
    ])

    // =========================
    // SAVE CUSTOMER
    // =========================
    const normalizedPhone = normalizePhone(customer.phone)

    if (normalizedPhone) {
      const existingUser = users.find(
        (user) =>
          normalizePhone(user.phone) === normalizedPhone
      )

      const userData = {
        name: customer.name.trim(),
        phone: normalizedPhone,
        address: customer.address.trim(),
        city: customer.city.trim(),
        email: customer.email.trim(),
        authUid: clientUser?.uid || null,
        createdAt:
          existingUser?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }

      try {
        await setDoc(
          doc(
            db,
            'users',
            userDocumentId(normalizedPhone)
          ),
          userData,
          { merge: true }
        )

        setUsers((currentUsers) => {
          const existing = currentUsers.find(
            (user) =>
              normalizePhone(user.phone) ===
              normalizedPhone
          )

          if (existing) {
            return currentUsers.map((user) =>
              user.id === existing.id
                ? { ...user, ...userData }
                : user
            )
          }

          return [
            {
              id: userDocumentId(normalizedPhone),
              ...userData,
            },
            ...currentUsers,
          ]
        })
      } catch (userError) {
        console.error(
          'Error saving customer profile:',
          userError
        )
      }
    }

    // =========================
    // ORDER SUCCESS
    // =========================
    setPlacedCustomerName(
      savedOrder.customer?.name || ''
    )

    setCart([])

    setOrderPlaced(true)

    setCustomer({
      name: '',
      phone: '',
      address: '',
      city: '',
      email: '',
    })

  } catch (error) {
    console.error(
      'Error placing order:',
      error
    )

    alert(
      error.message ||
        'Unable to place the order. Please try again.'
    )
  }
}

  // =========================
  // ORDER STATUS
  // =========================

  const updateOrderStatus = async (orderId, newStatus) => {
    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order) return

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.firebaseId)
        const orderSnapshot = await transaction.get(orderRef)

        if (!orderSnapshot.exists()) {
          throw new Error('Order no longer exists.')
        }

        const currentOrder = orderSnapshot.data()
        const updates = {
          status: newStatus,
        }

if (
  newStatus === 'Cancelled' &&
  currentOrder.status !== 'Cancelled' &&
  !currentOrder.stockRestored
) {
  for (const item of currentOrder.items) {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single()

    if (productError || !productData) {
      throw new Error(
        `Unable to find product ${item.name || item.id} in Supabase.`
      )
    }

    const newStock = productData.stock + item.quantity

    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.id)

    if (stockError) {
      throw new Error(
        `Unable to restore stock for ${item.name || item.id}.`
      )
    }
  }

  updates.stockRestored = true
}


        transaction.update(orderRef, updates)
      })

      const restoredItems =
        newStatus === 'Cancelled' &&
        order.status !== 'Cancelled' &&
        !order.stockRestored
          ? order.items
          : []

      if (restoredItems.length) {
        setProducts((currentProducts) =>
          currentProducts.map((product) => {
            const restoredItem = restoredItems.find(
              (item) => item.id === product.id
            )

            return restoredItem
              ? {
                  ...product,
                  stock:
                    product.stock + restoredItem.quantity,
                }
              : product
          })
        )
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === orderId
            ? {
                ...currentOrder,
                status: newStatus,
                stockRestored:
                  newStatus === 'Cancelled'
                    ? true
                    : currentOrder.stockRestored,
              }
            : currentOrder
        )
      )
    } catch (error) {
      console.error('Error updating order status:', error)
      alert(
        error.message ||
          'Unable to update the order in Firebase.'
      )
    }
  }

  // =========================
  // ORDER DOCUMENTS
  // =========================

  const getOrderCustomerEmail = (order) =>
    String(order?.customer?.email || '').trim()

  const getOrderFileNumber = (order) =>
    String(order?.id || 'order')
      .replace(/[^a-zA-Z0-9_-]/g, '-')

  const buildOrderPdf = (order, shippingDocument = false) => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    let y = 18

    const addLine = (text, x = 20, size = 10, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      pdf.text(String(text ?? ''), x, y)
      y += size * 0.55 + 4
    }

    const addWrapped = (text, x = 20, width = 170, size = 10, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      const lines = pdf.splitTextToSize(String(text ?? ''), width)
      pdf.text(lines, x, y)
      y += lines.length * (size * 0.55 + 2) + 4
    }

    const ensureSpace = (needed = 15) => {
      if (y + needed > 280) {
        pdf.addPage()
        y = 18
      }
    }

    addLine('CARETOOLS', 20, 18, true)
    addLine(
      shippingDocument ? 'BORDEREAU D\'EXPEDITION' : 'COMMANDE CONFIRMEE',
      20,
      14,
      true
    )
    y += 2

    addLine(`Commande : ${order?.id || '—'}`, 20, 10, true)
    addLine(`Date : ${order?.date || '—'}`)
    if (shippingDocument) {
      addLine(`Date d'expedition : ${new Date().toLocaleString()}`)
    }

    y += 3
    addLine('CLIENT', 20, 11, true)
    addLine(`Nom : ${order?.customer?.name || '—'}`)
    addLine(`Telephone : ${order?.customer?.phone || '—'}`)
    if (getOrderCustomerEmail(order)) {
      addLine(`Email : ${getOrderCustomerEmail(order)}`)
    }
    addWrapped(
      `Adresse : ${order?.customer?.address || '—'}${order?.customer?.city ? `, ${order.customer.city}` : ''}`
    )

    y += 3
    addLine('PRODUITS', 20, 11, true)

    const items = Array.isArray(order?.items) ? order.items : []
    items.forEach((item) => {
      ensureSpace(18)
      const itemName = item?.name || 'Produit'
      const quantity = Number(item?.quantity || 0)

      addWrapped(`${itemName} — Quantite : ${quantity}`, 20, 170, 10, true)

      if (!shippingDocument) {
        const unitPrice = Number(item?.price || 0)
        const lineTotal = unitPrice * quantity
        addLine(
          `Prix unitaire : ${formatPrice(unitPrice)}    Total : ${formatPrice(lineTotal)}`,
          25,
          9
        )
      }
    })

    y += 3
    ensureSpace(35)

    if (!shippingDocument) {
      addLine(`Sous-total : ${formatPrice(order?.subtotal)}`, 20, 10)
      addLine(`Livraison : ${formatPrice(order?.shipping)}`, 20, 10)
      addLine(`TOTAL : ${formatPrice(order?.total)}`, 20, 12, true)
    }

    if (shippingDocument) {
      y += 8
      addLine('OBSERVATIONS', 20, 11, true)
      addLine('____________________________________________', 20, 10)
      addLine('____________________________________________', 20, 10)
      y += 8
      ensureSpace(35)
      addLine('Signature client', 25, 10, true)
      addLine('____________________________', 20, 10)
      addLine('Signature livreur', 115, 10, true)
      pdf.text('____________________________', 110, y - 4)
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(
      'CareTools',
      pageWidth - 35,
      290,
      { align: 'right' }
    )

    return pdf
  }

  const downloadOrderPdf = (order) => {
    if (!order) return
    const pdf = buildOrderPdf(order, false)
    pdf.save(`CareTools-${getOrderFileNumber(order)}.pdf`)
  }

  const shareOrderPdf = async (order) => {
    if (!order) return

    try {
      const pdf = buildOrderPdf(order, false)
      const blob = pdf.output('blob')
      const file = new File(
        [blob],
        `CareTools-${getOrderFileNumber(order)}.pdf`,
        { type: 'application/pdf' }
      )

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `CareTools - Commande ${order.id}`,
          text: `Commande confirmée ${order.id}`,
          files: [file],
        })
        return
      }

      downloadOrderPdf(order)
      alert('Le partage de fichiers n’est pas disponible sur cet appareil. Le PDF a été téléchargé à la place.')
    } catch (error) {
      if (error?.name === 'AbortError') return
      console.error('Error sharing order PDF:', error)
      alert('Impossible de partager le PDF sur cet appareil.')
    }
  }

  const sendOrderByEmail = (order) => {
    if (!order) return

    const email = getOrderCustomerEmail(order)
    if (!email) {
      alert('Cette commande ne contient pas d’adresse email client.')
      return
    }

    const subject = encodeURIComponent(
      `CareTools - Commande confirmée ${order.id}`
    )

    const bodyLines = [
      `Bonjour ${order.customer?.name || ''},`,
      '',
      `Votre commande ${order.id} est confirmée.`,
      `Date : ${order.date || '—'}`,
      '',
      'Produits :',
      ...(order.items || []).map(
        (item) => `- ${item.name} x ${item.quantity}`
      ),
      '',
      `Total : ${formatPrice(order.total)}`,
      '',
      'Merci pour votre confiance.',
      'CareTools',
    ]

    const body = encodeURIComponent(bodyLines.join('\n'))
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
  }

  const createShippingDocument = (order) => {
    if (!order) return
    const pdf = buildOrderPdf(order, true)
    pdf.save(`CareTools-BL-${getOrderFileNumber(order)}.pdf`)
  }

  const cancelOrder = (orderId) => {
    const order = orders.find(
      (item) => item.id === orderId
    )

    if (!order || order.status === 'Cancelled') {
      return
    }

    if (
      !window.confirm(
        `Cancel order "${order.id}"? The ordered products will be returned to stock.`
      )
    ) {
      return
    }

    updateOrderStatus(orderId, 'Cancelled')
  }

  // =========================
  // ADMIN FORM
  // =========================

  const handleAdminChange = (event) => {
    const { name, value } = event.target

    setAdminForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'category' ? { subcategory: '' } : {}),
    }))
  }

  const resetAdminForm = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setEditingProduct(null)
    setAdminForm(emptyProduct)
    setSelectedImageFile(null)
    setImagePreviewUrl('')
    setImageUploading(false)
  }

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      event.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('The image must be smaller than 10 MB.')
      event.target.value = ''
      return
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, '')

    setSelectedImageFile(file)
    setImagePreviewUrl(previewUrl)

    setAdminForm((currentForm) => ({
      ...currentForm,
      image: file.name,
      name: currentForm.name.trim()
        ? currentForm.name
        : fileNameWithoutExtension,
    }))
  }

  const handleRemoveSelectedImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setSelectedImageFile(null)
    setImagePreviewUrl('')

    setAdminForm((currentForm) => ({
      ...currentForm,
      image: editingProduct?.images?.[0] || '',
    }))
  }

  const uploadProductImage = async (file, productId) => {
  const safeFileName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')

  const storagePath = `products/${productId}/${Date.now()}-${safeFileName}`

  const { error: uploadError } = await supabase.storage
    .from('products')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicUrlData } = supabase.storage
    .from('products')
    .getPublicUrl(storagePath)

  return publicUrlData.publicUrl
}
  const handleSaveProduct = async (event) => {
  event.preventDefault()

  if (selectedImageFile) {
    setImageUploading(true)
  }

  try {
    let imageUrlToSave = adminForm.image.trim()

    if (selectedImageFile) {
      const productId =
        editingProduct?.id || doc(collection(db, 'products')).id

      imageUrlToSave = await uploadProductImage(
        selectedImageFile,
        productId
      )
    }

    const priceValue =
      adminForm.price === '' ? null : Number(adminForm.price)

    const stockValue =
      adminForm.stock === '' ? null : Number(adminForm.stock)

    const productData = {
      name: adminForm.name.trim(),
      description: adminForm.description.trim() || null,
      price: priceValue,
      category: adminForm.category.trim(),
      subcategory: adminForm.subcategory.trim() || null,
      image: imageUrlToSave || null,
      video: adminForm.video.trim() || null,
      stock: stockValue,
      badge: adminForm.badge.trim() || null,
      productCode: adminForm.productCode.trim() || null,
      size: adminForm.size.trim() || null,
      status: adminForm.status || 'active',
    }

    if (
      !productData.name ||
      !productData.category ||
      (productData.price !== null && Number.isNaN(productData.price)) ||
      (productData.stock !== null && Number.isNaN(productData.stock))
    ) {
      alert('Please complete the required fields: Product Name and Category.')
      return
    }

    // =========================
    // UPDATE EXISTING PRODUCT
    // =========================
    if (editingProduct) {
      const { data: updatedProduct, error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          price: productData.price,
          category: productData.category,
          subcategory: productData.subcategory,
          description: productData.description,
          image: productData.image,
          stock: productData.stock,
          badge: productData.badge,
          video: productData.video,
          product_code: productData.productCode,
          size: productData.size,
          status: productData.status,
        })
        .eq('id', editingProduct.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      const updatedLocalProduct = {
        id: updatedProduct.id,
        name: updatedProduct.name || '',
        description: updatedProduct.description || '',
        price: updatedProduct.price ?? '',
        category: updatedProduct.category || '',
        subcategory: updatedProduct.subcategory || '',
        images: updatedProduct.image
          ? [updatedProduct.image]
          : [],
        video: updatedProduct.video || '',
        stock: updatedProduct.stock ?? '',
        badge: updatedProduct.badge || '',
        productCode: updatedProduct.product_code || '',
        size: updatedProduct.size || '',
        status: updatedProduct.status || 'active',
        createdAt: updatedProduct.created_at || '',
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingProduct.id
            ? updatedLocalProduct
            : product
        )
      )

      if (selectedProduct?.id === editingProduct.id) {
        setSelectedProduct(updatedLocalProduct)
      }

      setCart((currentCart) =>
        currentCart.map((item) =>
          item.id === editingProduct.id
            ? {
                ...item,
                ...updatedLocalProduct,
                quantity:
                  updatedLocalProduct.stock === null ||
                  updatedLocalProduct.stock === ''
                    ? item.quantity
                    : Math.min(
                        item.quantity,
                        updatedLocalProduct.stock
                      ),
              }
            : item
        )
      )

      alert('Product updated successfully!')
    } else {
      // =========================
      // ADD NEW PRODUCT
      // =========================
      const newProductData = {
        ...productData,
        createdAt: new Date().toISOString().slice(0, 10),
      }

      const { data: insertedProduct, error } = await supabase
        .from('products')
        .insert({
          name: newProductData.name,
          price: newProductData.price,
          category: newProductData.category,
          subcategory: newProductData.subcategory,
          description: newProductData.description,
          image: newProductData.image,
          stock: newProductData.stock,
          badge: newProductData.badge,
          video: newProductData.video,
          product_code: newProductData.productCode,
          size: newProductData.size,
          status: newProductData.status,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      const newProduct = {
        id: insertedProduct.id,
        name: insertedProduct.name || '',
        description: insertedProduct.description || '',
        price: insertedProduct.price ?? '',
        category: insertedProduct.category || '',
        subcategory: insertedProduct.subcategory || '',
        images: insertedProduct.image
          ? [insertedProduct.image]
          : [],
        video: insertedProduct.video || '',
        stock: insertedProduct.stock ?? '',
        badge: insertedProduct.badge || '',
        productCode: insertedProduct.product_code || '',
        size: insertedProduct.size || '',
        status: insertedProduct.status || 'active',
        createdAt:
          insertedProduct.created_at ||
          newProductData.createdAt,
      }

      setProducts((currentProducts) => [
        newProduct,
        ...currentProducts,
      ])

      alert('Product added successfully!')
    }

    resetAdminForm()
  } catch (error) {
    console.error('Error saving product:', error)

    alert(
      error.message ||
        'Unable to save the product in Supabase.'
    )
  } finally {
    setImageUploading(false)
  }
}

  const toggleProductStatus = async (id) => {
  const product = products.find((item) => item.id === id)

  if (!product) {
    return
  }

  const newStatus =
    product.status === 'active'
      ? 'inactive'
      : 'active'

  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        status: newStatus,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    const updatedProduct = {
      ...product,
      status: data?.status || newStatus,
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === id
          ? updatedProduct
          : currentProduct
      )
    )

    if (selectedProduct?.id === id) {
      setSelectedProduct(updatedProduct)
    }

    console.log(
      `Product "${product.name}" status changed to ${newStatus}`
    )
  } catch (error) {
    console.error(
      'Error updating product status in Supabase:',
      error
    )

    alert(
      error.message ||
        'Unable to update product status in Supabase.'
    )
  }
}

  const editProduct = (product) => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setEditingProduct(product)
    setSelectedImageFile(null)
    setImagePreviewUrl('')

    setAdminForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      image: product.images?.[0] || '',
      video: product.video || '',
      stock: product.stock ?? '',
      badge: product.badge || '',
      productCode: product.productCode || '',
      size: product.size || '',
      status: product.status || 'active',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }
const deleteProduct = async (id) => {
  const product = products.find((item) => item.id === id)

  if (!product) return

  if (!window.confirm(`Delete "${product.name}"?`)) {
    return
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      throw new Error(
        'The product was not deleted from Supabase.'
      )
    }

    setProducts((currentProducts) =>
      currentProducts.filter(
        (product) => product.id !== id
      )
    )

    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.id !== id
      )
    )

    if (editingProduct?.id === id) {
      resetAdminForm()
    }

    if (selectedProduct?.id === id) {
      navigateTo('products')
    }

    alert('Product deleted successfully!')
  } catch (error) {
    console.error(
      'Error deleting product:',
      error
    )

    alert(
      error.message ||
        'Unable to delete product from Supabase.'
    )
  }
}

  toggleProductStatus

  // =========================
  // IMAGE
  // =========================

  const imageUrl = (product, width = 600) =>
    product.images?.[0]
      ? `${product.images[0]}?auto=format&fit=crop&w=${width}&q=80`
      : ''

  
    // =========================
  // DASHBOARD STATISTICS
  // =========================

  
  const latestOrders = [...orders]
    .sort(
      (a, b) =>
        Number(b.createdAt || 0) -
        Number(a.createdAt || 0)
    )
    .slice(0, 5)
  
  
  // =========================
  // RENDER
  // =========================

    // =========================
  // ADMIN DASHBOARD STATISTICS
  // =========================

  const dashboardStats = useMemo(() => {
  const validOrders = orders.filter(
    (order) => order.status !== 'Cancelled'
  )

  const totalSales = validOrders.reduce(
    (total, order) => total + Number(order.total || 0),
    0
  )

  const activeProducts = products.filter(
    (product) => product.status === 'active'
  ).length

  const processingOrders = orders.filter(
    (order) => order.status === 'Processing'
  ).length

  const shippedOrders = orders.filter(
    (order) => order.status === 'Shipped'
  ).length

  const deliveredOrders = orders.filter(
    (order) => order.status === 'Delivered'
  ).length

  const cancelledOrders = orders.filter(
    (order) => order.status === 'Cancelled'
  ).length

  const lowStockProducts = products.filter(
  (product) => Number(product.stock || 0) < 5
)

const productSales = {}

validOrders.forEach((order) => {
  ;(order.items || []).forEach((item) => {
    if (!productSales[item.id]) {
      productSales[item.id] = {
        id: item.id,
        name: item.name || 'Unknown Product',
        quantity: 0,
        revenue: 0,
      }
    }

    productSales[item.id].quantity += Number(
      item.quantity || 0
    )

    productSales[item.id].revenue +=
      Number(item.price || 0) *
      Number(item.quantity || 0)
  })
})

const topSellingProducts = Object.values(productSales)
  .sort((a, b) => b.quantity - a.quantity)
  .slice(0, 5)

return {
  totalSales,
  totalOrders: orders.length,
  totalCustomers: users.length,
  totalProducts: products.length,
  activeProducts,
  processingOrders,
  shippedOrders,
  deliveredOrders,
  cancelledOrders,
  lowStockProducts,
  topSellingProducts,
}
}, [orders, users, products])

  return (
    <div className="app">

      <header className="navbar">

        <button
          className="logo-button"
          onClick={() => navigateTo('home')}
        >
      CareTools    
        </button>

        <nav className="main-nav">

  {[
    ['home', 'Home'],
    ['products', 'Products'],
    [
      'orders',
      `Orders${
        orders.length
          ? ` (${orders.length})`
          : ''
      }`,
    ],
    ['about', 'About'],
    ['account', clientUser ? 'My Account' : 'Login'],
    ['admin', 'Admin'],
  ].map(([page, label]) => (
    <button
      key={page}
      className={
        activePage === page ||
        (page === 'products' &&
          activePage === 'product-detail')
          ? 'nav-link active'
          : 'nav-link'
      }
      onClick={() => {
        if (page === 'admin' && adminUser) {
          setShowAdminMenu((current) => !current)
        } else if (page === 'account') {
          navigateTo('account')
        } else if (page === 'orders' && !clientUser && !adminUser) {
          requireClientLogin()
        } else {
          navigateTo(page)
        }
      }}
    >
      {label}{page === 'admin' && adminUser ? (showAdminMenu ? ' ▲' : ' ▼') : ''}
    </button>
  ))}

</nav>

        {adminUser && showAdminMenu && (
          <div style={{ position: 'absolute', top: '56px', right: '90px', zIndex: 1000, minWidth: '190px', padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
            {[
              ['dashboard', '📊 Dashboard'],
              ['customers', '👥 Customers'],
              ['orders', '📦 Orders'],
              ['products', '🛍️ Products'],
              ...(adminUser?.role === 'superadmin'
                ? [['admins', '👤 Administrators']]
                : []),
            ].map(([section, label]) => (
              <button
                key={section}
                type="button"
                className="nav-link"
                style={{ display: 'block', width: '100%', textAlign: 'left', margin: 0 }}
                onClick={() => {
                  setAdminSection(section)
                  setShowAdminMenu(false)
                  if (section === 'dashboard' || section === 'customers') {
                    navigateTo(section)
                  } else {
                    navigateTo('admin')
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <button
          className="cart-button"
          onClick={() => setIsCartOpen(true)}
        >
          🛒 Cart ({cartCount})
        </button>

      </header>

{/* DASHBOARD */}

{activePage === 'dashboard' && adminUser && (
  <main>

    <section className="dashboard-page">

      <div className="orders-page-header">

        <div>
          <p className="section-label">
            CareTools OVERVIEW
          </p>

          <h2>Dashboard</h2>

          <p>
            Overview of your products, customers,
            orders and sales.
          </p>
        </div>

      </div>

      {/* MAIN STATISTICS */}

      <div className="dashboard-stats-grid">

        <div className="dashboard-stat-card">
          <span className="dashboard-icon">
            📦
          </span>

          <div>
            <strong>
              {dashboardStats.totalProducts}
            </strong>

            <span>
              Total Products
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-icon">
            🟢
          </span>

          <div>
            <strong>
              {dashboardStats.activeProducts}
            </strong>

            <span>
              Active Products
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-icon">
            🛒
          </span>

          <div>
            <strong>
              {dashboardStats.totalOrders}
            </strong>

            <span>
              Total Orders
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-icon">
            👥
          </span>

          <div>
            <strong>
              {dashboardStats.totalCustomers}
            </strong>

            <span>
              Total Customers
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card dashboard-sales-card">
          <span className="dashboard-icon">
            💰
          </span>

          <div>
            <strong>
              {formatPrice(dashboardStats.totalSales)}
            </strong>

            <span>
              Total Sales
            </span>
          </div>
        </div>

      </div>

      {/* ORDER STATUS STATISTICS */}

      <section className="dashboard-status-section">

        <div className="dashboard-section-header">

          <div>
            <p className="section-label">
              ORDER STATUS
            </p>

            <h2>Orders Overview</h2>
          </div>

        </div>

        <div className="dashboard-stats-grid">

          <div className="dashboard-stat-card">
            <span className="dashboard-icon">
              ⏳
            </span>

            <div>
              <strong>
                {dashboardStats.processingOrders}
              </strong>

              <span>
                Processing
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <span className="dashboard-icon">
              🚚
            </span>

            <div>
              <strong>
                {dashboardStats.shippedOrders}
              </strong>

              <span>
                Shipped
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <span className="dashboard-icon">
              ✅
            </span>

            <div>
              <strong>
                {dashboardStats.deliveredOrders}
              </strong>

              <span>
                Delivered
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <span className="dashboard-icon">
              ❌
            </span>

            <div>
              <strong>
                {dashboardStats.cancelledOrders}
              </strong>

              <span>
                Cancelled
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <span className="dashboard-icon">
              ⚠️
            </span>

            <div>
              <strong>
                {dashboardStats.lowStockProducts.length}
              </strong>

              <span>
                Low Stock Products
              </span>
            </div>
          </div>

        </div>

      </section>

      {/* LOW STOCK PRODUCTS */}

      <section className="dashboard-recent-orders">

        <div className="dashboard-section-header">

          <div>
            <p className="section-label">
              INVENTORY ALERT
            </p>

            <h2>Low Stock Products</h2>
          </div>

          <button
            className="view-all-button"
            onClick={() => {
              setAdminSection('products')
              navigateTo('admin')
            }}
          >
            Manage Products →
          </button>

        </div>

        {!dashboardStats.lowStockProducts.length ? (

          <div className="empty-state">
            <h3>Stock levels are good</h3>

            <p>
              No products currently have fewer than
              5 items in stock.
            </p>
          </div>

        ) : (

          <div className="dashboard-orders-list">

            {dashboardStats.lowStockProducts.map(
              (product) => (

                <article
                  className="dashboard-order-card"
                  key={product.id}
                >

                  <div className="dashboard-order-info">

                    <span>
                      Product
                    </span>

                    <h3>
                      {product.name}
                    </h3>

                    <p>
                      {product.category}
                    </p>

                  </div>

                  <div className="dashboard-order-status">

                    <span className="order-status cancelled-order">
                      ⚠️ Low Stock
                    </span>

                  </div>

                  <div className="dashboard-order-total">

                    <span>
                      Available
                    </span>

                    <strong>
                      {product.stock}
                    </strong>
                  </div>

                </article>

              )
            )}

          </div>

        )}

      </section>

      {/* TOP SELLING PRODUCTS */}

      <section className="dashboard-recent-orders">

        <div className="dashboard-section-header">

          <div>
            <p className="section-label">
              SALES PERFORMANCE
            </p>

            <h2>Top Selling Products</h2>
          </div>

          <button
            className="view-all-button"
            onClick={() => {
              setAdminSection('products')
              navigateTo('admin')
            }}
          >
            View Products →
          </button>

        </div>

        {!dashboardStats.topSellingProducts.length ? (

          <div className="empty-state">
            <h3>No sales data yet</h3>

            <p>
              Top selling products will appear here
              after customers place orders.
            </p>
          </div>

        ) : (

          <div className="dashboard-orders-list">

            {dashboardStats.topSellingProducts.map(
              (product, index) => (

                <article
                  className="dashboard-order-card"
                  key={product.id}
                >

                  <div className="dashboard-order-info">

                    <span>
                      #{index + 1} Top Product
                    </span>

                    <h3>
                      {product.name}
                    </h3>

                    <p>
                      {product.quantity} units sold
                    </p>

                  </div>

                  <div className="dashboard-order-total">

                    <span>
                      Revenue
                    </span>

                    <strong>
                      {formatPrice(product.revenue)}
                    </strong>
                  </div>

                </article>

              )
            )}

          </div>

        )}

      </section>

      {/* LATEST ORDERS */}

      <section className="dashboard-recent-orders">

        <div className="dashboard-section-header">

          <div>
            <p className="section-label">
              RECENT ACTIVITY
            </p>

            <h2>
              Latest Orders
            </h2>
          </div>

          <button
            className="view-all-button"
            onClick={() => {
              setAdminSection('orders')
              navigateTo('admin')
            }}
          >
            View All →
          </button>

        </div>

        {!latestOrders.length ? (

          <div className="empty-state">
            <h3>
              No orders yet
            </h3>

            <p>
              Orders will appear here when customers
              place them.
            </p>
          </div>

        ) : (

          <div className="dashboard-orders-list">

            {latestOrders.map((order) => (

              <article
                className="dashboard-order-card"
                key={order.id}
              >

                <div className="dashboard-order-info">

                  <span>
                    Order number
                  </span>

                  <h3>
                    {order.id}
                  </h3>

                  <p>
                    {order.customer?.name ||
                      'Unknown customer'}
                  </p>

                  <small>
                    📱 {order.customer?.phone || '—'}
                  </small>

                </div>

                <div className="dashboard-order-date">

                  <span>
                    {order.date || '—'}
                  </span>
                </div>

                <div className="dashboard-order-status">

                  <span
                    className={`order-status ${
                      order.status === 'Cancelled'
                        ? 'cancelled-order'
                        : ''
                    }`}
                  >
                    {order.status}
                  </span>

                </div>

                <div className="dashboard-order-total">

                  <span>
                    Total
                  </span>

                  <strong>
                    {formatPrice(order.total)}
                  </strong>
                </div>

              </article>

            ))}

          </div>

        )}

      </section>

    </section>

  </main>
)}

      {/* HOME */}

      {activePage === 'home' && (
        <main>

          <section className="hero-section">
            <div>
              <p className="subtitle">
                WELCOME TO CareTools
              </p>

              <h1>
                Everything you need,
                <br />
                all in one place.
              </h1>

              <p>
                Discover quality products
                at great prices.
								
              </p>

			  <h3>
                Contact : +250 788 493 960
              </h3>

		      
              <button
                className="shop-button"
                onClick={() => navigateTo('products')}
              >
                Shop Now
              </button>
            </div>
          </section>

          <section className="home-products">

            <div className="products-heading">
              <div>
                <p className="section-label">
                  OUR COLLECTION
                </p>
                <h2>Featured Products</h2>
              </div>

              <button
                className="view-all-button"
                onClick={() => navigateTo('products')}
              >
                View All →
              </button>
            </div>

            <div className="products-grid">
              {products
                .filter(
                  (product) =>
                    product.status === 'active'
                )
                .slice(0, 6)
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={imageUrl}
                    openProduct={openProduct}
                    addToCart={addToCart}
                    showPrices={showPrices}
                    showStockStatus={showStockStatus}
                  />
                ))}
            </div>

          </section>

        </main>
      )}

      {/* PRODUCTS */}

      {activePage === 'products' && (
        <main>

          <section className="products-page">

            <div className="products-heading">
              <div>
                <p className="section-label">
                  OUR COLLECTION
                </p>
                <h2>All Products</h2>
              </div>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />

                {search && (
                  <button
                    onClick={() => setSearch('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="category-filters">
              {categories.map((category) => (
                <button
                  key={category}
                  className={
                    selectedCategory === category
                      ? 'category-button active'
                      : 'category-button'
                  }
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                >
                  {category}
                </button>
              ))}
            </div>

            {filteredProducts.length ? (
              <div className="products-grid">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={imageUrl}
                    openProduct={openProduct}
                    addToCart={addToCart}
                    showPrices={showPrices}
                    showStockStatus={showStockStatus}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No products found</h3>
                <p>
                  Try another search or category.
                </p>
              </div>
            )}

          </section>

        </main>
      )}

      {/* PRODUCT DETAIL */}

      {activePage === 'product-detail' &&
        selectedProduct && (
          <main>

            <section className="product-detail-page">

              <button
                className="back-products-button"
                onClick={() =>
                  navigateTo('products')
                }
              >
                ← Back to Products
              </button>

              <div className="product-detail">

                <div className="product-detail-gallery">

                  <div className="product-main-image">
                    {selectedProduct.images?.[selectedImage] ? (
                      <img
                        src={`${selectedProduct.images[selectedImage]}?auto=format&fit=crop&w=1000&q=90`}
                        alt={selectedProduct.name}
                      />
                    ) : (
                      <div className="product-image-placeholder">
                        No Image
                      </div>
                    )}

                    {selectedProduct.badge && (
                    <span className="product-badge">
                      {selectedProduct.badge}
                    </span>
                    )}
                  </div>

                  {selectedProduct.images.length > 1 && (
                    <div className="product-thumbnails">
                      {selectedProduct.images.map(
                        (image, index) => (
                          <button
                            key={image}
                            className={
                              selectedImage === index
                                ? 'thumbnail active'
                                : 'thumbnail'
                            }
                            onClick={() =>
                              setSelectedImage(index)
                            }
                          >
                            <img
                              src={`${image}?auto=format&fit=crop&w=200&q=80`}
                              alt=""
                            />
                          </button>
                        )
                      )}
                    </div>
                  )}

                </div>

                <div className="product-detail-info">

                  <span className="product-category">
                    {selectedProduct.category}
                  </span>

                  <h1>
                    {selectedProduct.name}
                  </h1>

                  {showPrices &&
                    selectedProduct.price !== null &&
                    selectedProduct.price !== '' && (
                      <div className="product-detail-price">
                        {formatPrice(selectedProduct.price)}
                      </div>
                    )}

                  {selectedProduct.productCode && (
                    <p>Product Code: {selectedProduct.productCode}</p>
                  )}

                  {selectedProduct.size && (
                    <p>Size: {selectedProduct.size}</p>
                  )}

                  {selectedProduct.description && (
                    <p className="product-description">
                      {selectedProduct.description}
                    </p>
                  )}

                  <p className="stock-text">
                    {selectedProduct.stock > 0
                      ? (showStockStatus
                          ? `${selectedProduct.stock} available in stock`
                          : 'In Stock')
                      : 'Out of Stock'}
                  </p>

                  {selectedProduct.stock > 0 && (
                    <>
                      <div className="detail-quantity">

                        <span>Quantity</span>

                        <div className="quantity-controls">

                          <button
                            onClick={() =>
                              setDetailQuantity(
                                Math.max(
                                  1,
                                  detailQuantity - 1
                                )
                              )
                            }
                          >
                            −
                          </button>

                          <span>
                            {detailQuantity}
                          </span>

                          <button
                            onClick={() =>
                              setDetailQuantity(
                                Math.min(
                                  selectedProduct.stock,
                                  detailQuantity + 1
                                )
                              )
                            }
                          >
                            +
                          </button>

                        </div>

                      </div>

                      <button
                        className="detail-add-button"
                        onClick={() => {
                          addToCart(
                            selectedProduct,
                            detailQuantity
                          )
                          setIsCartOpen(true)
                        }}
                      >
                        {showPrices &&
                        selectedProduct.price !== null &&
                        selectedProduct.price !== ''
                          ? `Add to Cart — ${formatPrice(
                              selectedProduct.price * detailQuantity
                            )}`
                          : 'Add to Cart'}
                      </button>
                    </>
                  )}

                </div>

              </div>

            </section>

          </main>
        )}

      {/* CLIENT ACCOUNT */}

      {activePage === 'account' && (
        <main>
          <section className="admin-page">
            {clientUser ? (
              <div className="admin-form">
                <p className="section-label">CLIENT ACCOUNT</p>
                <h2>My Account</h2>
                <p>{clientUser.email}</p>

                <button
                  className="shop-button"
                  onClick={() => navigateTo('orders')}
                >
                  View My Orders
                </button>

                <button
                  className="cancel-button"
                  style={{ marginTop: '10px' }}
                  onClick={handleClientLogout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <form className="admin-form" onSubmit={handleClientAuth}>
                <p className="section-label">CLIENT ACCOUNT</p>
                <h2>{clientAuthMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
                <p>Sign in to see only your own CareTools orders.</p>

                <label>
                  Email
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={clientPassword}
                    onChange={(event) => setClientPassword(event.target.value)}
                    required
                    minLength={6}
                    autoComplete={clientAuthMode === 'login' ? 'current-password' : 'new-password'}
                  />
                </label>

                {clientAuthError && (
                  <p className="login-error">{clientAuthError}</p>
                )}

                <button type="submit" className="shop-button" disabled={clientAuthLoading}>
                  {clientAuthLoading
                    ? 'Please wait...'
                    : clientAuthMode === 'login'
                      ? 'Sign In'
                      : 'Create Account'}
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  style={{ marginTop: '12px' }}
                  onClick={() => {
                    setClientAuthMode((current) => current === 'login' ? 'signup' : 'login')
                    setClientAuthError('')
                  }}
                >
                  {clientAuthMode === 'login'
                    ? 'Create a new account'
                    : 'I already have an account'}
                </button>
              </form>
            )}
          </section>
        </main>
      )}

      {/* ADMIN */}

      {activePage === 'admin' && (
        authLoading ? (
          <main><section className="admin-page"><div className="empty-state">Checking Admin access...</div></section></main>
        ) : !adminUser ? (
          <main>
            <section className="admin-page">
              <form className="admin-form" onSubmit={handleAdminLogin}>
                <p className="section-label">ADMINISTRATION</p>
                <h2>Admin Login</h2>
                <p>Sign in to manage CareTools.</p>
                <label>Email
                  <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required autoComplete="email" />
                </label>
                <label>Password
                  <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required autoComplete="current-password" />
                </label>
                {adminLoginError && <p className="login-error">{adminLoginError}</p>}
                <button type="submit" className="shop-button" disabled={adminLoginLoading}>
                  {adminLoginLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            </section>
          </main>
        ) : (
        <main>
          <section className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button className="cancel-button" onClick={handleAdminLogout}>Logout Admin</button>
            </div>

            <div className="admin-header">
              <div>
                <p className="section-label">
                  ADMINISTRATION
                </p>
                <h2>
                  Product Management
                </h2>
                <p>
                  Add, edit, activate or delete
                  your products.
                </p>
              </div>

              <div className="admin-stat">
                <strong>{products.length}</strong>
                <span>Total Products</span>
              </div>
            </div>

            {adminSection === 'products' && (
            <div className="admin-layout">

              <form
                className="admin-form"
                onSubmit={handleSaveProduct}
              >

                <h3>
                  {editingProduct
                    ? 'Edit Product'
                    : 'Add New Product'}
                </h3>

                <label>
                  Product Name *
                  <input
                    name="name"
                    value={adminForm.name}
                    onChange={handleAdminChange}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={adminForm.description}
                    onChange={handleAdminChange}
                  />
                </label>

                <div className="form-row">

                  <label>
                    Price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="price"
                      value={adminForm.price}
                      onChange={handleAdminChange}
                      placeholder="Optional"
                    />
                  </label>

                  <label>
                    Stock
                    <input
                      type="number"
                      min="0"
                      name="stock"
                      value={adminForm.stock}
                      onChange={handleAdminChange}
                      placeholder="Optional"
                    />
                  </label>

                </div>

                <label>
                  Category *
                  <select
                    name="category"
                    value={adminForm.category}
                    onChange={handleAdminChange}
                    required
                  >
                    <option value="">
                      Select a category
                    </option>

                    {categories
                      .filter((category) => category !== 'All')
                      .map((category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Subcategory
                  <select
                    name="subcategory"
                    value={adminForm.subcategory}
                    onChange={handleAdminChange}
                    disabled={!adminForm.category}
                  >
                    <option value="">
                      {adminForm.category
                        ? 'Select a subcategory'
                        : 'Select a category first'}
                    </option>
                    {(subcategoriesByCategory[adminForm.category] || []).map(
                      (subcategory) => (
                        <option key={subcategory} value={subcategory}>
                          {subcategory}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <div className="form-row">

                  <label>
                    Product Code
                    <input
                      name="productCode"
                      value={adminForm.productCode}
                      onChange={handleAdminChange}
                      placeholder="Optional"
                    />
                  </label>

                  <label>
                    Size
                    <input
                      name="size"
                      value={adminForm.size}
                      onChange={handleAdminChange}
                      placeholder="S, M, L, XL, 38, 39..."
                    />
                  </label>

                </div>

                <label>
                  Badge
                  <input
                    name="badge"
                    placeholder="New, Popular, Best Seller..."
                    value={adminForm.badge}
                    onChange={handleAdminChange}
                  />
                </label>

                <label>
                  Product Image

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <label
                        htmlFor="product-image-file"
                        className="shop-button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          margin: 0,
                        }}
                      >
                        Choose Image
                      </label>

                      <input
                        id="product-image-file"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={{ display: 'none' }}
                      />

                      {selectedImageFile && (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={handleRemoveSelectedImage}
                        >
                          Remove Image
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      name="image"
                      value={adminForm.image}
                      onChange={handleAdminChange}
                      placeholder="Choose an image from your computer..."
                      readOnly={Boolean(selectedImageFile)}
                    />

                    {(imagePreviewUrl || adminForm.image) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginTop: '4px',
                        }}
                      >
                        <img
                          src={imagePreviewUrl || adminForm.image}
                          alt="Product preview"
                          style={{
                            width: '90px',
                            height: '110px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                          }}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                        <small>
                          {selectedImageFile
                            ? `Selected: ${selectedImageFile.name}`
                            : 'Current image'}
                        </small>
                      </div>
                    )}

                    <small>
                      Select an image from your computer. The file will be uploaded to Firebase Storage when you save the product.
                    </small>
                  </div>
                </label>

                <label>
                  Video URL
                  <input
                    type="url"
                    name="video"
                    placeholder="https://..."
                    value={adminForm.video}
                    onChange={handleAdminChange}
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    value={adminForm.status}
                    onChange={handleAdminChange}
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>

                <div className="admin-form-buttons">

                  <button
                    type="submit"
                    className="shop-button"
                    disabled={imageUploading}
                  >
                    {imageUploading
                      ? 'Uploading Image...'
                      : editingProduct
                        ? 'Save Changes'
                        : 'Add Product'}
                  </button>

                  {editingProduct && (
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={resetAdminForm}
                    >
                      Cancel
                    </button>
                  )}

                </div>

              </form>

              <div className="admin-products">

                <h3>
                  All Products ({products.length})
                </h3>

                <div className="admin-product-list">

                  {products.map((product) => (
                    <article
                      className="admin-product-card"
                      key={product.id}
                    >

                      {product.images?.[0] ? (
                        <img
                          src={imageUrl(product, 150)}
                          alt={product.name}
                        />
                      ) : (
                        <div className="product-image-placeholder">
                          No Image
                        </div>
                      )}

                      <div className="admin-product-info">

                        <div>
                          <span
                            className={
                              product.status === 'active'
                                ? 'status active-status'
                                : 'status inactive-status'
                            }
                          >
                            {product.status}
                          </span>

                          <h4>
                            {product.name}
                          </h4>

                          <p>
                            {product.category}
                            {product.price !== null && product.price !== ''
                              ? ` · ${formatPrice(product.price)}`
                              : ''}
                          </p>

                          {product.productCode && (
                            <small>
                              Code: {product.productCode}
                            </small>
                          )}

                          {product.size && (
                            <small>
                              Size: {product.size}
                            </small>
                          )}

                          <small>
                            Stock: {
                              product.stock !== null && product.stock !== ''
                                ? product.stock
                                : 'Out of Stock'
                            }
                          </small>
                        </div>

                        <div className="admin-actions">

                          <button
                            onClick={() =>
                              editProduct(product)
                            }
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              toggleProductStatus(
                                product.id
                              )
                            }
                          >
                            {product.status === 'active'
                              ? 'Disable'
                              : 'Enable'}
                          </button>

                          <button
                            className="delete-button"
                            onClick={() =>
                              deleteProduct(product.id)
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                    </article>
                  ))}

                </div>

              </div>

            </div>

            )}

            {adminSection === 'orders' && (
            <>
            {/* ADMIN ORDER MANAGEMENT */}

            <section className="admin-orders-section">

              <div className="admin-orders-header">
                <div>
                  <p className="section-label">
                    ORDER MANAGEMENT
                  </p>
                  <h2>
                    Manage Orders
                  </h2>
                  <p>
                    Search, filter and update
                    customer orders.
                  </p>
                </div>

                <div className="admin-stat">
                  <strong>{orders.length}</strong>
                  <span>Total Orders</span>
                </div>
              </div>

              <div className="order-filters">

                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search order or customer..."
                    value={adminOrderSearch}
                    onChange={(event) =>
                      setAdminOrderSearch(
                        event.target.value
                      )
                    }
                  />

                  {adminOrderSearch && (
                    <button
                      onClick={() =>
                        setAdminOrderSearch('')
                      }
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={adminOrderStatusFilter}
                  onChange={(event) =>
                    setAdminOrderStatusFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="All">
                    All Statuses
                  </option>

                  {orderStatuses.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ))}
                </select>

              </div>

              {!filteredAdminOrders.length ? (
                <div className="empty-state">
                  <h3>No orders found</h3>
                  <p>
                    Try another search or filter.
                  </p>
                </div>
              ) : (
                
<div className="admin-orders-list">

  {filteredAdminOrders.map((order) => {

    const isSelected =
      selectedAdminOrder?.id === order.id

    return (
      <article
        className={`admin-order-row ${
          isSelected ? 'selected' : ''
        }`}
        key={order.id}
      >

        {/* RESUME DE LA COMMANDE */}

        <div
          className="admin-order-summary"
          onClick={() =>
            setSelectedAdminOrder(
              isSelected ? null : order
            )
          }
        >

          <div className="order-summary-date">
            <span>Date</span>
            <strong>{order.date}</strong>
          </div>

          <div className="order-summary-number">
            <span>Order</span>
            <strong>{order.id}</strong>
          </div>

          <div className="order-summary-customer">
            <span>Customer</span>
            <strong>
              {order.customer?.name || '—'}
            </strong>
          </div>

          <div className="order-summary-phone">
            <span>Phone</span>
            <strong>
              {order.customer?.phone || '—'}
            </strong>
          </div>

          <div className="order-summary-status">
            <span>Status</span>

            <select
              value={order.status}
              onClick={(event) =>
                event.stopPropagation()
              }
              onChange={(event) =>
                updateOrderStatus(
                  order.id,
                  event.target.value
                )
              }
            >
              {orderStatuses.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="order-summary-total">
            <span>Total</span>
            <strong>
              {formatPrice(order.total)}
            </strong>
          </div>

          <div className="order-summary-arrow">
            {isSelected ? '▲' : '▼'}
          </div>

        </div>


        {/* DETAIL DE LA COMMANDE */}

        {isSelected && (

          <div className="admin-order-details">

            <div className="order-detail-customer">

              <div>
                <span>Customer</span>
                <strong>
                  {order.customer?.name || '—'}
                </strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>
                  {order.customer?.phone || '—'}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {order.customer?.email || '—'}
                </strong>
              </div>

              <div>
                <span>Address</span>
                <strong>
                  {order.customer?.address || '—'}
                  {order.customer?.city
                    ? `, ${order.customer.city}`
                    : ''}
                </strong>
              </div>

            </div>


            <div className="admin-order-detail-items">

              <h3>Order Items</h3>

              {order.items.map((item) => (

                <div
                  className="admin-order-detail-item"
                  key={item.id}
                >

                  <img
                    src={imageUrl(item, 120)}
                    alt={item.name}
                  />

                  <div className="order-detail-item-info">

                    <strong>
                      {item.name}
                    </strong>

                    <span>
                      Qty: {item.quantity}
                    </span>

                  </div>

                  <strong>
                    {formatPrice(
                      item.price * item.quantity
                    )}
                  </strong>

                </div>

              ))}

            </div>


            {order.status === 'Confirmed' && (
              <div
                className="order-document-actions"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  margin: '20px 0',
                }}
              >
                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => setSelectedAdminOrder(order)}
                >
                  📄 Voir la commande
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => sendOrderByEmail(order)}
                >
                  📧 Envoyer au client
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => downloadOrderPdf(order)}
                >
                  📥 Télécharger PDF
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => shareOrderPdf(order)}
                >
                  📤 Partager PDF
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => createShippingDocument(order)}
                >
                  🚚 Créer bordereau d'expédition
                </button>
              </div>
            )}


            <div className="admin-order-detail-footer">

              <div>
                <span>Subtotal</span>
                <strong>
                  {formatPrice(order.subtotal)}
                </strong>
              </div>

              <div>
                <span>Shipping</span>
                <strong>
                  {formatPrice(order.shipping)}
                </strong>
              </div>

              <div className="order-detail-total">
                <span>Total</span>
                <strong>
                  {formatPrice(order.total)}
                </strong>
              </div>

            </div>


            {order.status !== 'Cancelled' && (

              <button
                className="delete-button"
                onClick={() =>
                  cancelOrder(order.id)
                }
              >
                Cancel Order
              </button>

            )}

          </div>

        )}

      </article>
    )

  })}

</div>


              )}

            </section>

            </>
            )}

            {adminSection === 'admins' && adminUser?.role === 'superadmin' && (
              <section className="admin-orders-section">
                <div className="admin-orders-header">
                  <div>
                    <p className="section-label">ADMINISTRATION</p>
                    <h2>Administrators</h2>
                    <p>Invite another administrator without disconnecting the Super Admin.</p>
                  </div>
                </div>

                <div
                  className="admin-form"
                  style={{ marginBottom: '24px' }}
                >
                  <h3>Client Display Settings</h3>
                  <p>
                    Control which product information customers can see.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      marginTop: '16px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={toggleShowPrices}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '14px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '10px',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>Show Prices</span>
                      <strong>{showPrices ? 'ON' : 'OFF'}</strong>
                    </button>

                    <button
                      type="button"
                      onClick={toggleShowStockStatus}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '14px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '10px',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>Show Stock Status</span>
                      <strong>{showStockStatus ? 'ON' : 'OFF'}</strong>
                    </button>
                  </div>
                </div>

                <form className="admin-form" onSubmit={handleInviteAdmin}>
                  <h3>Invite Administrator</h3>
                  <label>
                    Administrator email *
                    <input
                      type="email"
                      value={inviteAdminEmail}
                      onChange={(event) => setInviteAdminEmail(event.target.value)}
                      placeholder="admin@example.com"
                      required
                      autoComplete="email"
                    />
                  </label>

                  {inviteAdminMessage && (
                    <p style={{ marginTop: '12px' }}>{inviteAdminMessage}</p>
                  )}

                  <button type="submit" className="shop-button" disabled={inviteAdminLoading}>
                    {inviteAdminLoading ? 'Sending Invitation...' : 'Send Invitation'}
                  </button>
                </form>
              </section>
            )}

          </section>

        </main>
        )
      )}

            {/* ORDERS */}

      {activePage === 'orders' && (
        <main>

          <section className="orders-page">

            {!clientUser && !adminUser ? (
              <div className="empty-state">

                <h3>Sign in to view your orders</h3>

                <p>
                  Please sign in or create an account to view
                  your personal orders.
                </p>

                <button
                  className="shop-button"
                  onClick={() => navigateTo('account')}
                >
                  Sign In / Create Account
                </button>

              </div>
            ) : (
              <>
                <div className="orders-page-header">

                  <div>

                    <p className="section-label">
                      YOUR SHOPPING ACTIVITY
                    </p>

                    <h2>My Orders</h2>

                  </div>

                  <div className="orders-summary">

                    <strong>
                      {orders.length}
                    </strong>

                    <span>
                      Orders
                    </span>

                  </div>

                </div>

                {orders.length > 0 && (
                  <div className="order-filters">

                    <div className="search-box">

                      <input
                        type="text"
                        placeholder="Search order..."
                        value={orderSearch}
                        onChange={(event) =>
                          setOrderSearch(
                            event.target.value
                          )
                        }
                      />

                      {orderSearch && (
                        <button
                          onClick={() =>
                            setOrderSearch('')
                          }
                        >
                          ×
                        </button>
                      )}

                    </div>

                    <select
                      value={orderStatusFilter}
                      onChange={(event) =>
                        setOrderStatusFilter(
                          event.target.value
                        )
                      }
                    >

                      <option value="All">
                        All Statuses
                      </option>

                      {orderStatuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}

                    </select>

                  </div>
                )}

                {!orders.length ? (

                  <div className="empty-state">

                    <h3>
                      No orders yet
                    </h3>

                    <p>
                      You haven't placed any orders yet.
                    </p>

                    <button
                      className="shop-button"
                      onClick={() =>
                        navigateTo('products')
                      }
                    >
                      Start Shopping
                    </button>

                  </div>

                ) : !filteredOrders.length ? (

                  <div className="empty-state">

                    <h3>
                      No orders found
                    </h3>

                    <p>
                      Try another search or filter.
                    </p>

                  </div>

                ) : (

                  <div className="orders-list">

                    {filteredOrders.map((order) => (

                      <article
                        className="order-card"
                        key={order.id}
                      >

                        <div className="order-card-header">

                          <div>

                            <span>
                              Order number
                            </span>

                            <h3>
                              {order.id}
                            </h3>

                          </div>

                          <span
                            className={`order-status ${
                              order.status === 'Cancelled'
                                ? 'cancelled-order'
                                : ''
                            }`}
                          >

                            {order.status === 'Cancelled'
                              ? '✕'
                              : '✓'}

                            {' '}

                            {order.status}

                          </span>

                        </div>

                        <p>
                          {order.date}
                        </p>

                        {order.items.map((item) => (

                          <div
                            className="order-product"
                            key={item.id}
                          >

                            <img
                              src={imageUrl(item, 150)}
                              alt={item.name}
                            />

                            <div>

                              <strong>
                                {item.name}
                              </strong>

                              <span>
                                Qty: {item.quantity}
                              </span>

                            </div>

                            <strong>

                              {formatPrice(
                                item.price *
                                item.quantity
                              )}

                            </strong>

                          </div>

                        ))}

                        <div className="order-total">

                          <span>
                            Order Total
                          </span>

                          <strong>
                            {formatPrice(order.total)}
                          </strong>

                        </div>

                        {adminUser &&
                          order.status !== 'Cancelled' &&
                          order.status !== 'Delivered' && (

                            <button
                              className="cancel-order-button"
                              onClick={() =>
                                cancelOrder(order.id)
                              }
                            >
                              Cancel Order
                            </button>

                          )}

                      </article>

                    ))}

                  </div>

                )}

              </>
            )}

          </section>

        </main>
      )}
	  

      {/* CUSTOMERS */}

      {activePage === 'customers' && adminUser && (
        <main>
          <section className="orders-page">
            <div className="orders-page-header">
              <div>
                <p className="section-label">CUSTOMER MANAGEMENT</p>
                <h2>Customers</h2>
                <p>Customers who have placed orders in CareTools.</p>
              </div>
              <div className="orders-summary">
                <strong>{users.length}</strong>
                <span>Customers</span>
              </div>
            </div>

            <div className="order-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')}>×</button>
                )}
              </div>
            </div>

            {users.filter((user) => {
              const text = userSearch.toLowerCase()
              return (
                user.name?.toLowerCase().includes(text) ||
                user.phone?.toLowerCase().includes(text)
              )
            }).length === 0 ? (
              <div className="empty-state">
                <h3>No customers found</h3>
                <p>Customers appear here after their first order.</p>
              </div>
            ) : (
              <div className="admin-orders-list">
                {users
                  .filter((user) => {
                    const text = userSearch.toLowerCase()
                    return (
                      user.name?.toLowerCase().includes(text) ||
                      user.phone?.toLowerCase().includes(text)
                    )
                  })
                  .map((user) => {
                    const customerOrders = orders.filter(
                      (order) =>
                        normalizePhone(order.customer?.phone) ===
                        normalizePhone(user.phone)
                    )

                    const totalSpent = customerOrders
                      .filter((order) => order.status !== 'Cancelled')
                      .reduce(
                        (total, order) => total + Number(order.total || 0),
                        0
                      )

                    return (
                      <article className="admin-order-card" key={user.id}>
                        <div className="admin-order-top">
                          <div>
                            <span>Customer</span>
                            <h3>{user.name || 'Unnamed customer'}</h3>
                            <p>📱 {user.phone}</p>
                          </div>
                          <div className="admin-stat">
                            <strong>{customerOrders.length}</strong>
                            <span>Orders</span>
                          </div>
                        </div>

                        <div className="order-customer-info">
                          <span>{user.address}</span>
                          <span>
                            {user.city}
                          </span>
                          {user.email && <span>✉️ {user.email}</span>}
                        </div>

                        <div className="admin-order-footer">
                          <strong>Total spent: {formatPrice(totalSpent)}</strong>
                          <span>
                            Updated:{' '}
                            {user.updatedAt
                              ? new Date(user.updatedAt).toLocaleDateString()
                              : '—'}
                          </span>
                        </div>
                      </article>
                    )
                  })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ABOUT */}

      {activePage === 'about' && (
        <main>
          <section className="about-page">
            <div className="about-content">
              <p className="section-label">
                ABOUT CareTools
              </p>

              <h2>
                Simple shopping.
                <br />
                Quality products.
              </h2>

              <p>
                CareTools makes it easy to discover
                products, manage your cart and
                place orders.
              </p>

              <div className="about-features">

                <div>
                  <strong>🛍️</strong>
                  <h3>Quality Products</h3>
                  <p>
                    Carefully selected products.
                  </p>
                </div>

                <div>
                  <strong>🚚</strong>
                  <h3>Fast Delivery</h3>
                  <p>
                    Flexible delivery options.
                  </p>
                </div>

                <div>
                  <strong>🔒</strong>
                  <h3>Simple Checkout</h3>
                  <p>
                    Easy ordering experience.
                  </p>
                </div>

              </div>

            </div>
          </section>
        </main>
      )}

      {/* CART */}

      {isCartOpen && (
        <>
          <div
            className="cart-overlay"
            onClick={() => setIsCartOpen(false)}
          />

          <aside className="cart-drawer">

            <div className="cart-header">
              <div>
                <span className="section-label">
                  SHOPPING BAG
                </span>
                <h2>Your Cart</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setIsCartOpen(false)}
              >
                ×
              </button>
            </div>

            {!cart.length ? (
              <div className="empty-cart">
                <h3>Your cart is empty</h3>
                <p>
                  Add some products to get started.
                </p>

                <button
                  className="shop-button"
                  onClick={() => {
                    setIsCartOpen(false)
                    navigateTo('products')
                  }}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">

                  {cart.map((item) => (
                    <div
                      className="cart-item"
                      key={item.id}
                    >

                      <img
                        src={imageUrl(item, 200)}
                        alt={item.name}
                      />

                      <div className="cart-item-content">

                        <div className="cart-item-top">

                          <div>
                            <h3>{item.name}</h3>
                            <p>
                              {formatPrice(item.price)}
                            </p>
                            <small>
                              Available stock:
                              {' '}
                              {products.find(
                                (product) =>
                                  product.id === item.id
                              )?.stock ?? item.stock}
                            </small>
                          </div>

                          <button
                            className="close-button"
                            onClick={() =>
                              removeFromCart(item.id)
                            }
                          >
                            ×
                          </button>

                        </div>

                        <div className="cart-item-bottom">

                          <div className="quantity-controls">

                            <button
                              onClick={() =>
                                decreaseQuantity(item.id)
                              }
                            >
                              −
                            </button>

                            <span>
                              {item.quantity}
                            </span>

                            <button
                              disabled={
                                item.quantity >=
                                (products.find(
                                  (product) =>
                                    product.id === item.id
                                )?.stock ?? item.stock)
                              }
                              onClick={() =>
                                increaseQuantity(item.id)
                              }
                            >
                              +
                            </button>

                          </div>

                          <strong>
                            {formatPrice(
                              item.price *
                              item.quantity
                            )}
                          </strong>

                        </div>

                      </div>

                    </div>
                  ))}

                </div>

                <div className="cart-footer">

                  <div className="cart-total">
                    <span>Subtotal</span>
                    <strong>
                      {formatPrice(cartTotal)}
                    </strong>
                  </div>

                  <button
                    className="checkout-button"
                    onClick={openCheckout}
                  >
                    Checkout
                  </button>

                </div>
              </>
            )}

          </aside>
        </>
      )}

      {/* CHECKOUT */}

      {isCheckoutOpen && (
        <div className="checkout-overlay">

          <div className="checkout-modal">

            <div className="checkout-header">

              <div>
                <span className="section-label">
                  CHECKOUT
                </span>
                <h2>Checkout</h2>
              </div>

              <button
                className="close-button"
                onClick={closeCheckout}
              >
                ×
              </button>

            </div>

            {orderPlaced ? (
              <div className="order-success">

                <div className="success-icon">
                  ✓
                </div>

                <h2>Order Confirmed!</h2>

                <p>
                  Thank you for your purchase,
                  {` ${placedCustomerName}`}.
                </p>

                <button
                  className="shop-button"
                  onClick={() => {
                    closeCheckout()
                    navigateTo('orders')
                  }}
                >
                  View My Orders
                </button>

              </div>
            ) : (
              <div className="checkout-content">

                <form
                  className="checkout-form"
                  onSubmit={handlePlaceOrder}
                >

                  <h3>Customer Information</h3>

                  <label>
                    Full Name
                    <input
                      name="name"
                      value={customer.name}
                      onChange={handleCustomerChange}
                      required
                    />
                  </label>

                  <label>
                    Phone Number
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Example: +250 78 123 4567"
                      value={customer.phone}
                      onChange={handleCustomerChange}
                      required
                    />
                  </label>

                  <h3>Shipping Address</h3>

                  <label>
                    Address
                    <input
                      name="address"
                      value={customer.address}
                      onChange={handleCustomerChange}
                      required
                    />
                  </label>

                  <div className="form-row">

                    <label>
                      City
                      <input
                        name="city"
                        value={customer.city}
                        onChange={handleCustomerChange}
                        required
                      />
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        name="email"
                        value={customer.email}
                        onChange={handleCustomerChange}
                        placeholder="Email"
                      />
                    </label>

                  </div>

                  <button
                    type="submit"
                    className="place-order-button"
                  >
                    Place Order — {formatPrice(finalTotal)}
                  </button>

                </form>

                <aside className="order-summary">

                  <h3>Order Summary</h3>

                  {cart.map((item) => (
                    <div
                      className="summary-item"
                      key={item.id}
                    >

                      <img
                        src={imageUrl(item, 150)}
                        alt={item.name}
                      />

                      <div>
                        <strong>
                          {item.name}
                        </strong>
                        <span>
                          Qty: {item.quantity}
                        </span>
                      </div>

                      <b>
                        {formatPrice(
                          item.price *
                          item.quantity
                        )}
                      </b>

                    </div>
                  ))}

                  <div className="summary-line">
                    <span>Subtotal</span>
                    <span>
                      {formatPrice(cartTotal)}
                    </span>
                  </div>

                  <div className="summary-total">
                    <span>Total</span>
                    <strong>
                      {formatPrice(finalTotal)}
                    </strong>
                  </div>

                </aside>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

// =========================
// PRODUCT CARD
// =========================

function ProductCard({
  product,
  imageUrl,
  openProduct,
  addToCart,
  showPrices,
  showStockStatus,
}) {
  return (
    <article
      className="product-card"
      onClick={() => openProduct(product)}
    >

      <div className="product-image">

        {product.images?.[0] ? (
          <img
            src={imageUrl(product)}
            alt={product.name}
          />
        ) : (
          <div className="product-image-placeholder">
            No Image
          </div>
        )}

        {product.badge && (
          <span className="product-badge">
            {product.badge}
          </span>
        )}

      </div>

      <div className="product-info">

        <span className="product-category">
          {product.category}
        </span>

        <h3>{product.name}</h3>

        <p className="card-stock">
          {product.stock > 0
            ? (showStockStatus
                ? `${product.stock} in stock`
                : 'In Stock')
            : 'Out of Stock'}
        </p>

        <div className="product-bottom">

          {showPrices &&
            product.price !== null &&
            product.price !== '' && (
              <p>
                {formatPrice(product.price)}
              </p>
            )}

          <button
            className="add-button"
            disabled={product.stock <= 0}
            onClick={(event) => {
              event.stopPropagation()
              addToCart(product)
            }}
          >
            {product.stock > 0
              ? 'Add to Cart'
              : 'Out of Stock'}
          </button>

        </div>

      </div>

    </article>
  )
}

export default App