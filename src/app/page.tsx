import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Leaf, Droplets, Sun, Sprout } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile) {
      switch (profile.role) {
        case "Admin": redirect("/admin");
        case "SuperDistributor": redirect("/super-distributor");
        case "FieldOfficer": redirect("/bookings");
        case "Dealer": redirect("/dealer");
        case "Telecaller": redirect("/telecaller");
        case "Counselor": redirect("/counselor");
      }
    }
  }

  return <LandingPageUI />;
}

function LandingPageUI() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white selection:bg-green-200">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image src="/logo.png" alt="Bioeagle Logo" fill className="object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-blue-950 tracking-tight leading-none">
                  Bio Eagle Petroleum Pvt Ltd
                </span>
                <span className="text-sm font-medium text-green-600">Agricultural Division</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/login"
                className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 bg-blue-900 rounded-full hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Portal Login
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <section className="relative overflow-hidden pt-20 pb-32">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
            <div className="w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-green-50 to-blue-50 opacity-50 blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 font-medium text-sm mb-8 border border-green-100 shadow-sm">
                <Sprout className="w-4 h-4" />
                <span>Cultivating a Sustainable Future</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold text-blue-950 tracking-tight mb-8 leading-tight">
                Premium Agricultural <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                  Products & Services
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Bio Eagle Petroleum Pvt Ltd's Agricultural Division specializes in high-yield, organic farming. We deliver top-tier plants and comprehensive agricultural management.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#products"
                  className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-green-600 to-green-500 rounded-full hover:shadow-xl hover:shadow-green-500/20 transition-all duration-300 transform hover:-translate-y-1"
                >
                  Explore Products
                </a>
                <a
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-blue-900 bg-white border border-blue-100 rounded-full hover:bg-blue-50 transition-all duration-300"
                >
                  Access ERP Portal
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Benefits */}
        <section className="py-20 bg-blue-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm border border-white/5">
                  <Leaf className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">100% Organic</h3>
                <p className="text-blue-200">Cultivated using sustainable methods without harmful chemicals to ensure premium quality.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm border border-white/5">
                  <Droplets className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Irrigation</h3>
                <p className="text-blue-200">State-of-the-art water management systems ensuring optimal growth and resource conservation.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm border border-white/5">
                  <Sun className="w-8 h-8 text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Climate Optimized</h3>
                <p className="text-blue-200">Saplings bred for maximum resilience and yield across varying climatic conditions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-blue-950 mb-4">Our Core Offerings</h2>
              <p className="text-lg text-gray-500">Premium saplings for commercial farming</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              
              {/* Product 1: Moringa */}
              <div className="group rounded-3xl overflow-hidden bg-white shadow-xl shadow-gray-200/50 border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-900/10">
                <div className="relative h-80 w-full overflow-hidden">
                  <Image 
                    src="/moringa.png" 
                    alt="Premium Moringa Plantation" 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="absolute bottom-6 left-8 text-3xl font-bold text-white">Moringa (Drumstick)</h3>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                    Our high-yield Moringa saplings are cultivated for rapid growth and superior pod production. Known as the "miracle tree," our variety ensures maximum nutritional value and commercial viability.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-green-500" /> Fast-growing commercial variety
                    </li>
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-green-500" /> Drought-resistant properties
                    </li>
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-green-500" /> High biomass and pod yield
                    </li>
                  </ul>
                </div>
              </div>

              {/* Product 2: Mango */}
              <div className="group rounded-3xl overflow-hidden bg-white shadow-xl shadow-gray-200/50 border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-900/10">
                <div className="relative h-80 w-full overflow-hidden">
                  <Image 
                    src="/mango.png" 
                    alt="Premium Mango Orchard" 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="absolute bottom-6 left-8 text-3xl font-bold text-white">Premium Mango</h3>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                    We offer superior grafted mango saplings that guarantee early fruiting and exceptional fruit quality. Our orchards are designed for high-density planting and maximum profitability.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-blue-500" /> Authentic grafted varieties
                    </li>
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-blue-500" /> Disease-resistant rootstock
                    </li>
                    <li className="flex items-center gap-3 text-gray-700 font-medium">
                      <CheckIcon className="w-5 h-5 text-blue-500" /> Optimized for high-density farming
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-50 border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative w-8 h-8 opacity-50 grayscale">
                <Image src="/logo.png" alt="Bioeagle Logo" fill className="object-contain" />
              </div>
              <span className="font-semibold text-gray-900">Bio Eagle Petroleum Pvt Ltd</span>
            </div>
            <p>© {new Date().getFullYear()} Bio Eagle Petroleum Pvt Ltd - Agricultural Division. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}
