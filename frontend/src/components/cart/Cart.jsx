import React, { useState } from "react";
import Header from "../header/Header";
import Leftsidebar from "../left/Leftsidebar";
import useGetUserProfile from "./../../hooks/useGetUserProfile";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import CartPage from "./CartPage";
import { Home, Bell, PlusSquare, MessageCircle, Menu } from "lucide-react";
import MobileNavItem from "../left/MobileNavItem";
import MobileSidebar from "../left/MobileSidebar";

const Profile = () => {
  const params = useParams();
  const userId = params.id;
  useGetUserProfile(userId);
  const { userProfile } = useSelector((store) => store.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  return (
    <div>
      <div className="min-h-screen flex flex-col">
        <Header />
        {/* Main Layout */}
        <div className="flex flex-1 flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
          {/* Left Sidebar sticky on md+ */}
          <aside className="hidden md:flex md:flex-col md:w-20 lg:w-64">
            <Leftsidebar />
          </aside>

          {/* Center Content */}
          <CartPage/>
        </div>
        
        {/* Mobile Sidebar */}
        <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 block md:hidden bg-white border-t shadow-lg z-50">
          <div className="flex justify-around items-center h-16">
            <MobileNavItem icon={<Home size={24} />} label="Home" path="/" />
            <MobileNavItem icon={<Bell size={24} />} label="Notifications" path="/notifications" />
            <MobileNavItem icon={<PlusSquare size={24} />} label="Post" path="/create-post" isPostButton={true} />
            <MobileNavItem icon={<MessageCircle size={24} />} label="Messages" path="/chat/chatpage" />
            <button 
              onClick={toggleSidebar} 
              className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none"
            >
              <Menu size={24} />
              <span className="text-xs mt-1">Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
