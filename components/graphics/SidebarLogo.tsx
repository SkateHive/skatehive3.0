"use client";
import React from "react";
import { useLastAuction } from "../../hooks/auction";
import { useRouter } from "next/navigation";
import PixelTransition from "./PixelTransition";
import { Image, useToken } from "@chakra-ui/react";
import SkateHiveLogo from "./SkateHiveLogo";
import { DAO_ADDRESSES } from "@/lib/utils/constants";

const SidebarLogo = () => {
  const { data: activeAuction } = useLastAuction(DAO_ADDRESSES.token);
  const router = useRouter();
  const [pixelColor] = useToken("colors", ["primary"]);

  return (
    <PixelTransition
      firstContent={
        <SkateHiveLogo
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            cursor: "pointer",
          }}
          onClick={() =>
            router.push(
              `/auction`
            )
          }
        />
      }
      secondContent={
        <Image
          src={activeAuction?.token?.image || "https://www.skatehive.app/SKATE_HIVE_VECTOR_FIN.svg"}
          alt="SkateHive Hover Logo"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onClick={() =>
            router.push(
              `/auction`
            )
          }
          cursor={"pointer"}
        />
      }
      pixelColor={pixelColor}
      animationStepDuration={0.4}
    />
  );
};

export default SidebarLogo;
