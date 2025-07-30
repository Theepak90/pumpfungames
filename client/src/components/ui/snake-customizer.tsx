import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Palette } from "lucide-react";

const SNAKE_COLORS = [
  { name: "Neon Green", value: "#00FF88", gradient: "bg-gradient-to-r from-green-400 to-green-600" },
  { name: "Electric Blue", value: "#5465FF", gradient: "bg-gradient-to-r from-blue-400 to-blue-600" },
  { name: "Hot Pink", value: "#FF1493", gradient: "bg-gradient-to-r from-pink-400 to-pink-600" },
  { name: "Golden Yellow", value: "#FFD700", gradient: "bg-gradient-to-r from-yellow-400 to-yellow-600" },
  { name: "Cyber Purple", value: "#9D4EDD", gradient: "bg-gradient-to-r from-purple-400 to-purple-600" },
  { name: "Toxic Orange", value: "#FF6B35", gradient: "bg-gradient-to-r from-orange-400 to-orange-600" },
  { name: "Ice Blue", value: "#00C9FF", gradient: "bg-gradient-to-r from-cyan-400 to-cyan-600" },
  { name: "Laser Red", value: "#FF073A", gradient: "bg-gradient-to-r from-red-400 to-red-600" },
];

export function SnakeCustomizer() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(user?.snakeColor || "#00FF88");

  if (!user) return null;

  const handleColorChange = async (color: string) => {
    try {
      await apiRequest("PUT", `/api/users/${user.id}/snake-color`, { color });
      updateUser({ snakeColor: color });
      setSelectedColor(color);
      
      toast({
        title: "Snake Customized",
        description: "Your snake appearance has been updated!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update snake appearance",
        variant: "destructive",
      });
    }
  };

  const SnakePreview = ({ color, size = "large" }: { color: string; size?: "small" | "large" }) => {
    const headSize = size === "large" ? "w-16 h-16" : "w-8 h-8";
    const eyeSize = size === "large" ? "w-3 h-3" : "w-1.5 h-1.5";
    const pupilSize = size === "large" ? "w-1 h-1" : "w-0.5 h-0.5";
    const segmentSizes = size === "large" 
      ? ["w-12 h-12", "w-10 h-10", "w-8 h-8"] 
      : ["w-6 h-6", "w-5 h-5", "w-4 h-4"];
    
    return (
      <div className="flex items-center justify-center">
        <div className="relative">
          {/* Snake head */}
          <div 
            className={`${headSize} rounded-full relative`}
            style={{ backgroundColor: color }}
          >
            {/* Eyes */}
            <div className={`absolute top-3 left-3 ${eyeSize} bg-white rounded-full`}>
              <div className={`absolute top-1 left-1 ${pupilSize} bg-black rounded-full`}></div>
            </div>
            <div className={`absolute top-3 right-3 ${eyeSize} bg-white rounded-full`}>
              <div className={`absolute top-1 right-1 ${pupilSize} bg-black rounded-full`}></div>
            </div>
          </div>
          
          {/* Snake body segments */}
          {segmentSizes.map((sizeClass, index) => (
            <div
              key={index}
              className={`absolute ${sizeClass} rounded-full -z-${index + 10}`}
              style={{ 
                backgroundColor: color, 
                opacity: 0.8 - (index * 0.2),
                left: `-${(index + 1) * (size === "large" ? 16 : 8)}px`,
                top: `${(index + 1) * (size === "large" ? 8 : 4)}px`
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-dark-card border-dark-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Customize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Snake preview */}
          <div className="bg-dark-bg rounded-lg p-6 snake-preview">
            <SnakePreview color={user.snakeColor} />
          </div>

          <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-dark-bg border border-dark-border text-white hover:border-neon-green transition-colors">
                <Palette className="w-4 h-4 mr-2" />
                Change Appearance
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-dark-card border-dark-border text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Palette className="w-6 h-6 neon-green" />
                  <span>Customize Snake</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Current preview */}
                <div className="text-center">
                  <div className="bg-dark-bg rounded-lg p-4 mb-2">
                    <SnakePreview color={selectedColor} size="small" />
                  </div>
                  <p className="text-sm text-gray-400">Preview</p>
                </div>

                {/* Color options */}
                <div className="grid grid-cols-4 gap-3">
                  {SNAKE_COLORS.map((colorOption) => (
                    <button
                      key={colorOption.value}
                      onClick={() => setSelectedColor(colorOption.value)}
                      className={`relative aspect-square rounded-lg transition-all duration-200 ${
                        selectedColor === colorOption.value
                          ? 'ring-2 ring-neon-yellow ring-offset-2 ring-offset-dark-card scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: colorOption.value }}
                      title={colorOption.name}
                    >
                      {selectedColor === colorOption.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Apply button */}
                <Button 
                  onClick={() => {
                    handleColorChange(selectedColor);
                    setIsCustomizeOpen(false);
                  }}
                  className="w-full bg-neon-green text-black hover:bg-green-400 font-semibold"
                  disabled={selectedColor === user.snakeColor}
                >
                  Apply Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
}
