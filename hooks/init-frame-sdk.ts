'use client';

import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';

const InitFrameSDK = () => {
    useEffect(() => {
        const load = async () => {
            try {
                if (await sdk.isInMiniApp()) {
                    await sdk.actions.ready();
                }
            } catch (error) {
                console.error("Failed to initialize Farcaster Frame SDK", error);
            }
        };

        load();
    }, []);

    return null;
};

export default InitFrameSDK;
