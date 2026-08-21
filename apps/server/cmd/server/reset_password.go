package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/term"
	"shadowedge/server/internal/httpapi"
)

func runPasswordReset(dataFile string) error {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Логин: ")
	username, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("не удалось прочитать логин: %w", err)
	}

	fmt.Print("Новый пароль: ")
	password, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil {
		return fmt.Errorf("не удалось прочитать пароль: %w", err)
	}

	fmt.Print("Повтори новый пароль: ")
	confirmation, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil {
		return fmt.Errorf("не удалось прочитать подтверждение пароля: %w", err)
	}
	if string(password) != string(confirmation) {
		return fmt.Errorf("пароли не совпадают")
	}

	if err := httpapi.ResetAccountPassword(dataFile, strings.TrimSpace(username), string(password)); err != nil {
		return err
	}

	fmt.Println("Пароль успешно изменён. Теперь можно запустить приложение и войти с новым паролем.")
	return nil
}
