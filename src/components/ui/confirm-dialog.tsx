"use client";

import {
    Modal,
    ModalBackdrop,
    ModalContainer,
    ModalDialog,
    ModalHeader,
    ModalHeading,
    ModalBody,
    ModalFooter,
    Button,
    useOverlayState,
} from "@heroui/react";
import { useEffect } from "react";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    isDangerous?: boolean;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirmar",
    isDangerous = false,
}: ConfirmDialogProps) {
    const state = useOverlayState({
        isOpen,
        onOpenChange: (open) => {
            if (!open) onClose();
        },
    });

    useEffect(() => {
        if (isOpen) {
            state.open();
        } else {
            state.close();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <Modal state={state}>
            <ModalBackdrop />
            <ModalContainer>
                <ModalDialog>
                    <ModalHeader>
                        <ModalHeading>{title}</ModalHeading>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-default-600">{description}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onPress={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            variant={isDangerous ? "danger" : "primary"}
                            onPress={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmLabel}
                        </Button>
                    </ModalFooter>
                </ModalDialog>
            </ModalContainer>
        </Modal>
    );
}
