"use client";
import { useEffect } from "react";
import { initFaro } from "@/lib/faro";

export default function FaroInit() {
  useEffect(() => {
    initFaro();
  }, []);
  return null;
}
