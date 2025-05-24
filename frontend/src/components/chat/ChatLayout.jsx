import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../header/Header";
import Leftsidebar from "../left/Leftsidebar";
import ChatRightSideBar from "./ChatRightSideBar";
import { Home, Bell, PlusSquare, MessageCircle, Menu } from "lucide-react";
import MobileNavItem from "../left/MobileNavItem";
import MobileSidebar from "../left/MobileSidebar";

const ChatLayout = () => {
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

          {/* Center Content - Give it more space since conversation list is now in a drawer */}
          <div className="flex-1 md:max-w-[calc(100%-320px)] lg:max-w-[calc(100%-600px)]">
            <Outlet />
          </div>

          {/* Right Sidebar */}
          <aside className="hidden lg:block lg:w-[300px] mr-5">
            <ChatRightSideBar/>
          </aside>
        </div>
        
        {/* Mobile Sidebar Drawer */}
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

export default ChatLayout;
