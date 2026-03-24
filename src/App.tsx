import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  LogOut, 
  Send, 
  User as UserIcon, 
  MessageSquare, 
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Post {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: Timestamp | null;
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message || String(error) };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-stone-200 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">문제가 발생했습니다</h1>
            <p className="text-stone-600 mb-6">앱을 실행하는 도중 오류가 발생했습니다.</p>
            <div className="bg-stone-100 p-4 rounded-xl text-left text-xs font-mono text-stone-500 overflow-auto max-h-40 mb-6">
              {this.state.errorInfo}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-3 rounded-full font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App Component ---
function BulletinBoard() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Posts Listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setPosts([]);
      setIsLoadingPosts(false);
      return;
    }

    setIsLoadingPosts(true);
    const q = query(
      collection(db, 'posts'), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(fetchedPosts);
      setIsLoadingPosts(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Handle Login
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Handle Submit Post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'posts'), {
        content: newPost.trim(),
        authorId: user.uid,
        authorName: user.displayName || '익명',
        authorPhoto: user.photoURL,
        createdAt: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setIsSending(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-stone-200 text-center"
        >
          <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-serif font-black text-stone-900 mb-4 tracking-tight">모두의 게시판</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            자유롭게 생각을 나누는 공간입니다.<br />
            구글 계정으로 로그인하여 시작해보세요.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Google 계정으로 로그인
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-stone-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-serif font-bold tracking-tight">모두의 게시판</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-stone-500" />
                </div>
              )}
              <span className="text-sm font-medium text-stone-600">{user.displayName}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 pb-32">
        {/* Post Input */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 mb-8">
          <form onSubmit={handleSubmit} className="relative">
            <textarea 
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="무슨 생각을 하고 계신가요?"
              className="w-full min-h-[120px] p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 resize-none text-stone-800 placeholder-stone-400 transition-all"
              maxLength={1000}
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-stone-400 font-mono">
                {newPost.length} / 1000
              </span>
              <button 
                type="submit"
                disabled={!newPost.trim() || isSending}
                className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg active:scale-95"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                게시하기
              </button>
            </div>
          </form>
        </div>

        {/* Posts List */}
        <div className="space-y-6">
          {isLoadingPosts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
              <p className="text-stone-400">아직 게시글이 없습니다. 첫 글을 남겨보세요!</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {posts.map((post) => (
                <motion.div 
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {post.authorPhoto ? (
                      <img src={post.authorPhoto} alt={post.authorName} className="w-10 h-10 rounded-full border border-stone-100" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-stone-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-stone-900 leading-none mb-1">{post.authorName}</h3>
                      <p className="text-xs text-stone-400 font-mono">
                        {post.createdAt ? format(post.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '방금 전'}
                      </p>
                    </div>
                  </div>
                  <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BulletinBoard />
    </ErrorBoundary>
  );
}

