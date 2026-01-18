export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="w-full max-w-md p-8 glass rounded-2xl border border-white/10">
                <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                    Admin Access
                </h1>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
                            placeholder="admin@nexiplay.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <button className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-900/30">
                        Sign In
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-600">
                    Restricted Area. Authorized Personnel Only.
                </p>
            </div>
        </div>
    );
}
