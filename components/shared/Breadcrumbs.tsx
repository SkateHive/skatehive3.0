import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, Text } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import NextLink from "next/link";

export interface BreadcrumbItemData {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItemData[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <Breadcrumb
      spacing="4px"
      separator={<ChevronRightIcon color="textSecondary" boxSize={3} />}
      fontSize="sm"
      color="textSecondary"
      mb={4}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <BreadcrumbItem
            key={index}
            isCurrentPage={isLast || item.isCurrentPage}
          >
            {isLast || item.isCurrentPage ? (
              <Text
                color="primary"
                fontWeight="medium"
                maxW={{ base: "150px", md: "300px" }}
                isTruncated
              >
                {item.label}
              </Text>
            ) : (
              <BreadcrumbLink
                as={NextLink}
                href={item.href || "#"}
                _hover={{ color: "primary" }}
                transition="color 0.2s"
              >
                {item.label}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
}
