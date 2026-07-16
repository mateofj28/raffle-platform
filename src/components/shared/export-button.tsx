"use client";

import {
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    Button,
} from "@heroui/react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface ExportButtonProps {
    onExportExcel: () => void;
    onExportPdf: () => void;
    isLoading?: boolean;
}

export function ExportButton({
    onExportExcel,
    onExportPdf,
    isLoading = false,
}: ExportButtonProps) {
    return (
        <Dropdown>
            <DropdownTrigger>
                <Button
                    variant="outline"
                    size="sm"
                    isDisabled={isLoading}
                >
                    <Download className="h-4 w-4" />
                    Exportar
                </Button>
            </DropdownTrigger>
            <DropdownPopover>
                <DropdownMenu
                    aria-label="Export options"
                    onAction={(key) => {
                        if (key === "excel") onExportExcel();
                        if (key === "pdf") onExportPdf();
                    }}
                >
                    <DropdownItem id="excel" textValue="Exportar Excel">
                        <span className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Exportar Excel
                        </span>
                    </DropdownItem>
                    <DropdownItem id="pdf" textValue="Exportar PDF">
                        <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Exportar PDF
                        </span>
                    </DropdownItem>
                </DropdownMenu>
            </DropdownPopover>
        </Dropdown>
    );
}
