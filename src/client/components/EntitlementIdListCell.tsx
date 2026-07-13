import { ReactNode } from 'react';
import { EntitlementIdLink, EntitlementIdList, EntitlementIdListItem } from './styles.js';

export type EntitlementIdListEntry = {
    displayId: string;
    searchPath: 'licenses' | 'transactions';
    suffix?: ReactNode;
};

export function EntitlementIdListCell({ entries }: { entries: EntitlementIdListEntry[] }) {
    return (
        <EntitlementIdList>
            {entries.map((entry, index) => (
                <EntitlementIdListItem key={`${entry.displayId}-${index}`}>
                    <EntitlementIdLink to={`/${entry.searchPath}?search=${encodeURIComponent(entry.displayId)}`}>
                        {entry.displayId}
                    </EntitlementIdLink>
                    {entry.suffix}
                    {index < entries.length - 1 ? ',' : ''}
                </EntitlementIdListItem>
            ))}
        </EntitlementIdList>
    );
}
