import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../header/Header";
import Leftsidebar from "../left/Leftsidebar";
import ChatRightSideBar from "./ChatRightSideBar";

const ChatLayout = () => {
  return (
    <div className="h-screen overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header - always visible, adaptive height */}
        <div className="flex-shrink-0">
          <Header />
        </div>
        
        {/* Main Layout - takes remaining height */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar - hidden on mobile, visible on tablet+ */}
          <aside className="hidden md:flex md:flex-col md:w-16 lg:w-64 border-r border-gray-200 overflow-y-auto">
            <Leftsidebar />
          </aside>

          {/* Center Content - scrollable, takes available height */}
          <div className="flex-1 overflow-hidden flex flex-col h-full md:max-w-[calc(100%-16rem)] lg:max-w-[calc(100%-30rem)]">
            <Outlet />
          </div>

          {/* Right Sidebar - hidden on small screens, visible on large screens */}
          <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 border-l border-gray-200 overflow-y-auto">
            <ChatRightSideBar/>
          </aside>
        </div>
        
        {/* Mobile Navigation - fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 block md:hidden py-1 px-2 shadow-lg bg-white border-t z-40">
          <Leftsidebar />
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
