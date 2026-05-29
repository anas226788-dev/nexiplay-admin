import MovieForm from '@/components/admin/MovieForm';

export default function AddContentPage() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Add New Content</h1>
                <p className="text-gray-400">Create a new movie, series, or anime entry.</p>
            </div>

            <MovieForm />
        </div>
    );
}
