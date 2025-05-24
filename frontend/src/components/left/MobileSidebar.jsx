import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { 
  Heart, 
  User, 
  Truck, 
  Settings, 
  X,
  ShoppingCart,
  Receipt
} from "lucide-react";

const MobileSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  
  const sidebarOptions = [
    {
      icon: <Heart size={24} />,
      label: "Favorites",
      onClick: () => {
        navigate("/favorites");
        onClose();
      }
    },
    {
      icon: <User size={24} />,
      label: "Profile",
      onClick: () => {
        navigate(`/profile/${user?._id}`);
        onClose();
      }
    },
    {
      icon: <ShoppingCart size={24} />,
      label: "Cart",
      onClick: () => {
        navigate("/cartPage");
        onClose();
      }
    },
    {
      icon: <Receipt size={24} />,
      label: "Orders",
      onClick: () => {
        navigate("/orders");
        onClose();
      }
    },
    {
      icon: <Truck size={24} />,
      label: "Delivery",
      onClick: () => {
        navigate("/deliver/dashboard");
        onClose();
      }
    },
    {
      icon: <Settings size={24} />,
      label: "Admin",
      onClick: () => {
        navigate("/admin/dashboard");
        onClose();
      },
      role: "admin"
    }
  ];

  // Filter options based on user role
  const filteredOptions = sidebarOptions.filter(option => {
    if (!option.role) return true;
    if (option.role === "admin" && user?.role === "admin") return true;
    if (option.role === "delivery" && (user?.role === "delivery" || user?.role === "admin")) return true;
    return false;
  });

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed right-0 top-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Menu</h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* Options */}
          <div className="flex-1 overflow-y-auto py-4">
            {filteredOptions.map((option, index) => (
              <button
                key={index}
                onClick={option.onClick}
                className="flex items-center w-full px-6 py-4 hover:bg-gray-100 transition-colors duration-150"
              >
                <span className="text-gray-600 mr-4">{option.icon}</span>
                <span className="text-gray-800">{option.label}</span>
              </button>
            ))}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t">
            <button
              onClick={onClose}
              className="w-full py-2 text-center text-gray-600 hover:text-gray-800"
            >
              Close Menu
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileSidebar;
