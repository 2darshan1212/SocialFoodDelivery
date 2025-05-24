import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreatePost from "../post/CreatePost";

const MobileNavItem = ({ icon, label, path, isPostButton = false, badgeCount }) => {
  const navigate = useNavigate();
  const [openPost, setOpenPost] = useState(false);

  const handleClick = () => {
    if (isPostButton) {
      setOpenPost(true);
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex flex-col items-center justify-center p-2 text-gray-600 hover:text-primary-600 focus:outline-none relative"
      >
        {badgeCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        {icon}
        <span className="text-xs mt-1">{label}</span>
      </button>

      {isPostButton && (
        <CreatePost open={openPost} setOpen={setOpenPost} />
      )}
    </>
  );
};

export default MobileNavItem;
