package httpapi

import (
	"reflect"
	"regexp"
	"unicode/utf8"
)

var mojibakePattern = regexp.MustCompile(`(?:Р.|С.){2,}|вЂ`)

func repairStorageEncoding(state *storageState) bool {
	if state == nil {
		return false
	}
	return repairMojibakeValue(reflect.ValueOf(state))
}

func repairMojibakeValue(value reflect.Value) bool {
	if !value.IsValid() {
		return false
	}

	switch value.Kind() {
	case reflect.Pointer:
		if value.IsNil() {
			return false
		}
		return repairMojibakeValue(value.Elem())
	case reflect.Interface:
		if value.IsNil() {
			return false
		}
		element := value.Elem()
		clone := reflect.New(element.Type()).Elem()
		clone.Set(element)
		if !repairMojibakeValue(clone) {
			return false
		}
		value.Set(clone)
		return true
	case reflect.Struct:
		changed := false
		for index := 0; index < value.NumField(); index++ {
			field := value.Field(index)
			if !field.CanSet() && field.Kind() != reflect.Pointer && field.Kind() != reflect.Slice && field.Kind() != reflect.Struct {
				continue
			}
			if repairMojibakeValue(field) {
				changed = true
			}
		}
		return changed
	case reflect.Slice, reflect.Array:
		changed := false
		for index := 0; index < value.Len(); index++ {
			if repairMojibakeValue(value.Index(index)) {
				changed = true
			}
		}
		return changed
	case reflect.String:
		if !value.CanSet() {
			return false
		}
		repaired, changed := repairMojibakeString(value.String())
		if changed {
			value.SetString(repaired)
		}
		return changed
	default:
		return false
	}
}

func repairMojibakeString(value string) (string, bool) {
	current := value
	changed := false

	for attempt := 0; attempt < 3 && looksLikeMojibake(current); attempt++ {
		next, ok := decodeWindows1251UTF8(current)
		if !ok || next == current {
			break
		}
		current = next
		changed = true
	}

	return current, changed
}

func looksLikeMojibake(value string) bool {
	return mojibakePattern.MatchString(value)
}

func decodeWindows1251UTF8(value string) (string, bool) {
	encoded, ok := encodeWindows1251Bytes(value)
	if !ok || !utf8.Valid(encoded) {
		return "", false
	}
	return string(encoded), true
}

var windows1251Specials = map[rune]byte{
	'\u0402': 0x80,
	'\u0403': 0x81,
	'\u201A': 0x82,
	'\u0453': 0x83,
	'\u201E': 0x84,
	'\u2026': 0x85,
	'\u2020': 0x86,
	'\u2021': 0x87,
	'\u20AC': 0x88,
	'\u2030': 0x89,
	'\u0409': 0x8A,
	'\u2039': 0x8B,
	'\u040A': 0x8C,
	'\u040C': 0x8D,
	'\u040B': 0x8E,
	'\u040F': 0x8F,
	'\u0452': 0x90,
	'\u2018': 0x91,
	'\u2019': 0x92,
	'\u201C': 0x93,
	'\u201D': 0x94,
	'\u2022': 0x95,
	'\u2013': 0x96,
	'\u2014': 0x97,
	'\u2122': 0x99,
	'\u0459': 0x9A,
	'\u203A': 0x9B,
	'\u045A': 0x9C,
	'\u045C': 0x9D,
	'\u045B': 0x9E,
	'\u045F': 0x9F,
	'\u00A0': 0xA0,
	'\u040E': 0xA1,
	'\u045E': 0xA2,
	'\u0408': 0xA3,
	'\u00A4': 0xA4,
	'\u0490': 0xA5,
	'\u00A6': 0xA6,
	'\u00A7': 0xA7,
	'\u0401': 0xA8,
	'\u00A9': 0xA9,
	'\u0404': 0xAA,
	'\u00AB': 0xAB,
	'\u00AC': 0xAC,
	'\u00AD': 0xAD,
	'\u00AE': 0xAE,
	'\u0407': 0xAF,
	'\u00B0': 0xB0,
	'\u00B1': 0xB1,
	'\u0406': 0xB2,
	'\u0456': 0xB3,
	'\u0491': 0xB4,
	'\u00B5': 0xB5,
	'\u00B6': 0xB6,
	'\u00B7': 0xB7,
	'\u0451': 0xB8,
	'\u2116': 0xB9,
	'\u0454': 0xBA,
	'\u00BB': 0xBB,
	'\u0458': 0xBC,
	'\u0405': 0xBD,
	'\u0455': 0xBE,
	'\u0457': 0xBF,
}

func encodeWindows1251Bytes(value string) ([]byte, bool) {
	result := make([]byte, 0, len(value))
	for _, symbol := range value {
		switch {
		case symbol >= 0 && symbol <= 0x7F:
			result = append(result, byte(symbol))
		case symbol >= 0x80 && symbol <= 0xFF:
			result = append(result, byte(symbol))
		case symbol >= '\u0410' && symbol <= '\u044F':
			result = append(result, byte(symbol-0x350))
		default:
			mapped, ok := windows1251Specials[symbol]
			if !ok {
				return nil, false
			}
			result = append(result, mapped)
		}
	}
	return result, true
}
