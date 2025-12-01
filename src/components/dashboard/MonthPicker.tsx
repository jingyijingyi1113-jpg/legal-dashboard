import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, setMonth, setYear } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
    value?: Date;
    onChange: (date: Date) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value || new Date());

    const handleMonthSelect = (month: number) => {
        const newDate = setMonth(viewDate, month);
        onChange(newDate);
        setOpen(false);
    };

    const months = Array.from({ length: 12 }, (_, i) => i);
    const currentYear = viewDate.getFullYear();

    return (
        <Popover open={open} onOpenChange={(isOpen) => { 
            if(isOpen) {
                setViewDate(value || new Date());
            }
            setOpen(isOpen);
        }}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !value && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? format(value, "yyyy-MM") : <span>Pick a month</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <div className="p-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() - 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">{currentYear}</span>
                        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() + 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {months.map((month) => (
                            <Button
                                key={month}
                                variant={value && value.getMonth() === month && value.getFullYear() === currentYear ? "default" : "ghost"}
                                onClick={() => handleMonthSelect(month)}
                                className="text-sm"
                            >
                                {format(setMonth(new Date(), month), "MMM")}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}