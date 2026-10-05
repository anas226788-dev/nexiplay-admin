import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

/**
 * Custom hook to fetch data from Supabase with SWR caching.
 * @param key Unique key for the query (or null to skip)
 * @param table Table name
 * @param queryBuilder Optional query modifier function
 */
export function useSupabaseQuery<T>(
    key: string | null,
    table: string,
    queryBuilder?: (query: any) => any,
    initialData?: T
) {
    const fetcher = async () => {
        let query = supabase.from(table).select('*');
        if (queryBuilder) {
            query = queryBuilder(query);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data as T;
    };

    return useSWR(key, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 60000, // Cache for 1 minute
        fallbackData: initialData,
    });
}
