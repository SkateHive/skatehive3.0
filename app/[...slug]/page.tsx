// app/page.tsx
'use client';

import React from "react";
import PostPage from "@/components/blog/PostPage";
import NotificationsComp from "@/components/notifications/NotificationsComp";
import ProfilePage from "@/components/profile/ProfilePage";
import MainWallet from "@/components/wallet/MainWallet";

type ParamsType = { slug?: string[] };

export default function HomePage(props: any) {
  const params = React.use(props.params) as ParamsType;

  if (!params?.slug || !Array.isArray(params.slug)) {
    return <></>;
  }

    if (params.slug.length === 1 && decodeURIComponent(params.slug[0]).startsWith('@')) {
      return (
        <ProfilePage username={decodeURIComponent(params.slug[0]).substring(1)} />
      )
    } else if ((params.slug.length === 2 && decodeURIComponent(params.slug[0]).startsWith('@')) && params.slug[1] === 'wallet') {
      return (
        <MainWallet username={decodeURIComponent(params.slug[0]).slice(1)} />
      )
    } else if ((params.slug.length === 2 && decodeURIComponent(params.slug[0]).startsWith('@')) && params.slug[1] === 'notifications') {
      return (
        <NotificationsComp username={decodeURIComponent(params.slug[0]).slice(1)} />
      )
    } else if ((params.slug.length === 2 && decodeURIComponent(params.slug[0]).startsWith('@')) || (params.slug.length === 3 && decodeURIComponent(params.slug[1]).startsWith('@'))) {
      return (
        <PostPage author={decodeURIComponent(params.slug[0]).substring(1)} permlink={params.slug[1]} />
      )
    }

  return (
    <></>

  );
}
