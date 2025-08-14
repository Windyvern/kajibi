
import { MapPin, Star } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  distance: string;
  image: string;
  priceRange: string;
}

interface RestaurantCardsProps {
  restaurants?: Restaurant[];
}

export const RestaurantCards = ({ restaurants }: RestaurantCardsProps) => {
  // Mock data - in real app, this would come from props or API
  const mockRestaurants: Restaurant[] = [
    {
      id: '1',
      name: 'Le Petit Bistro',
      cuisine: 'French',
      rating: 4.8,
      distance: '0.2 km',
      image: 'photo-1514933651103-005eec06c04b',
      priceRange: '€€€'
    },
    {
      id: '2',
      name: 'Sushi Zen',
      cuisine: 'Japanese',
      rating: 4.6,
      distance: '0.4 km',
      image: 'photo-1579584425555-c3ce17fd4351',  
      priceRange: '€€€€'
    },
    {
      id: '3',
      name: 'Trattoria Roma',
      cuisine: 'Italian',
      rating: 4.5,
      distance: '0.6 km',
      image: 'photo-1555396273-367ea4eb4db5',
      priceRange: '€€'
    },
    {
      id: '4',
      name: 'The Garden Café',
      cuisine: 'Mediterranean',
      rating: 4.3,
      distance: '0.8 km',
      image: 'photo-1517248135467-4c7edcad34c4',
      priceRange: '€€'
    }
  ];

  const displayRestaurants = restaurants || mockRestaurants;

  return (
    <div className="h-full">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Nearby Restaurants</h3>
      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
        {displayRestaurants.map((restaurant) => (
          <div 
            key={restaurant.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex gap-3">
              <img
                src={`https://images.unsplash.com/${restaurant.image}?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80&q=80`}
                alt={restaurant.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">{restaurant.name}</h4>
                <p className="text-xs text-gray-600 mb-1">{restaurant.cuisine}</p>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500 fill-current" />
                    <span className="text-xs text-gray-700">{restaurant.rating}</span>
                  </div>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-600">{restaurant.priceRange}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-600">{restaurant.distance}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
