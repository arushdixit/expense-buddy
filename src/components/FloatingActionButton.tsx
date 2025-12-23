import React from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
}) => {
  return (
    <motion.button
      onClick={onClick}
      className="fab"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <Plus className="h-7 w-7" />
    </motion.button>
  );
};
