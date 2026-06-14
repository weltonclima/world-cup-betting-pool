/**
 * Snapshot de paridade ESPN↔openfootball (TASK-02 / H2) — gerado do dado AO VIVO
 * em 2026-06-14 contra site.api.espn.com (liga fifa.world) + openfootball/worldcup.json.
 *
 * Evidência: buildEspnMatchId sobre estes 72 eventos de grupo + 32 de mata-mata
 * (num 73–104) reproduz EXATAMENTE EXPECTED_GROUP_IDS / EXPECTED_KO_IDS, que são
 * os matchIds canônicos do openfootball (buildMatchId). Paridade 104/104 verificada.
 *
 * Eventos trimados aos campos lidos por buildEspnMatchId (id, date, season,
 * venue.address.city, competitors[home/away].team.abbreviation). NÃO passam pelo
 * schema Zod (placar/status omitidos de propósito — não afetam o matchId); o teste
 * faz cast para EspnEvent. Regenerar só se o calendário oficial mudar.
 */
import type { EspnEvent } from "../../espnTypes";

export const ESPN_GROUP_EVENTS = [
  {
    "id": "760415",
    "date": "2026-06-11T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Mexico City"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "MEX"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RSA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760414",
    "date": "2026-06-12T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalajara"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "KOR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CZE"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760416",
    "date": "2026-06-12T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CAN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "BIH"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760417",
    "date": "2026-06-13T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "USA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "PAR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760420",
    "date": "2026-06-13T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "QAT"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SUI"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760419",
    "date": "2026-06-13T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "BRA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "MAR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760418",
    "date": "2026-06-14T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "HAI"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SCO"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760421",
    "date": "2026-06-14T04:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "AUS"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "TUR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760422",
    "date": "2026-06-14T17:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "GER"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CUW"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760425",
    "date": "2026-06-14T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NED"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "JPN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760423",
    "date": "2026-06-14T23:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CIV"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ECU"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760424",
    "date": "2026-06-15T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalupe"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SWE"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "TUN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760428",
    "date": "2026-06-15T16:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ESP"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CPV"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760426",
    "date": "2026-06-15T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "BEL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "EGY"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760429",
    "date": "2026-06-15T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "KSA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "URU"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760427",
    "date": "2026-06-16T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "IRN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "NZL"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760432",
    "date": "2026-06-16T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "FRA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SEN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760430",
    "date": "2026-06-16T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "IRQ"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "NOR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760433",
    "date": "2026-06-17T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ARG"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ALG"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760431",
    "date": "2026-06-17T04:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "AUT"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "JOR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760435",
    "date": "2026-06-17T17:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "POR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "COD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760437",
    "date": "2026-06-17T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ENG"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CRO"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760434",
    "date": "2026-06-17T23:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "GHA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "PAN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760436",
    "date": "2026-06-18T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Mexico City"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "UZB"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "COL"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760438",
    "date": "2026-06-18T16:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CZE"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RSA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760439",
    "date": "2026-06-18T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SUI"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "BIH"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760440",
    "date": "2026-06-18T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CAN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "QAT"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760441",
    "date": "2026-06-19T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalajara"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "MEX"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "KOR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760442",
    "date": "2026-06-19T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "USA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "AUS"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760445",
    "date": "2026-06-19T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SCO"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "MAR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760444",
    "date": "2026-06-20T00:30Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "BRA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "HAI"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760443",
    "date": "2026-06-20T03:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "TUR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "PAR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760447",
    "date": "2026-06-20T17:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NED"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SWE"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760448",
    "date": "2026-06-20T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "GER"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CIV"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760446",
    "date": "2026-06-21T00:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ECU"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CUW"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760449",
    "date": "2026-06-21T04:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalupe"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "TUN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "JPN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760453",
    "date": "2026-06-21T16:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ESP"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "KSA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760451",
    "date": "2026-06-21T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "BEL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "IRN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760450",
    "date": "2026-06-21T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "URU"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CPV"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760452",
    "date": "2026-06-22T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NZL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "EGY"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760456",
    "date": "2026-06-22T17:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ARG"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "AUT"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760457",
    "date": "2026-06-22T21:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "FRA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "IRQ"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760454",
    "date": "2026-06-23T00:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NOR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SEN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760455",
    "date": "2026-06-23T03:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "JOR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ALG"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760461",
    "date": "2026-06-23T17:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "POR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "UZB"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760458",
    "date": "2026-06-23T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ENG"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "GHA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760460",
    "date": "2026-06-23T23:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "PAN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CRO"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760459",
    "date": "2026-06-24T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalajara"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "COL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "COD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760462",
    "date": "2026-06-24T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "BIH"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "QAT"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760463",
    "date": "2026-06-24T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SUI"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CAN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760464",
    "date": "2026-06-24T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "MAR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "HAI"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760465",
    "date": "2026-06-24T22:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SCO"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "BRA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760467",
    "date": "2026-06-25T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Mexico City"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CZE"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "MEX"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760466",
    "date": "2026-06-25T01:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalupe"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RSA"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "KOR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760473",
    "date": "2026-06-25T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CUW"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "CIV"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760468",
    "date": "2026-06-25T20:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ECU"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "GER"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760471",
    "date": "2026-06-25T23:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "JPN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SWE"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760472",
    "date": "2026-06-25T23:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "TUN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "NED"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760469",
    "date": "2026-06-26T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "PAR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "AUS"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760470",
    "date": "2026-06-26T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "TUR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "USA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760475",
    "date": "2026-06-26T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NOR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "FRA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760474",
    "date": "2026-06-26T19:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SEN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "IRQ"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760478",
    "date": "2026-06-27T00:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CPV"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "KSA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760479",
    "date": "2026-06-27T00:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalajara"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "URU"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ESP"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760476",
    "date": "2026-06-27T03:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "EGY"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "IRN"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760477",
    "date": "2026-06-27T03:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "NZL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "BEL"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760480",
    "date": "2026-06-27T21:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "CRO"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "GHA"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760485",
    "date": "2026-06-27T21:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "PAN"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ENG"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760481",
    "date": "2026-06-27T23:30Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "COL"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "POR"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760482",
    "date": "2026-06-27T23:30Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "COD"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "UZB"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760484",
    "date": "2026-06-28T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "ALG"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "AUT"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760483",
    "date": "2026-06-28T02:00Z",
    "season": {
      "slug": "group-stage",
      "type": 13802
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "JOR"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "ARG"
            }
          }
        ]
      }
    ]
  }
] as unknown as EspnEvent[];

export const ESPN_KO_EVENTS_CHRONO = [
  {
    "id": "760486",
    "date": "2026-06-28T19:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "2A"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2B"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760487",
    "date": "2026-06-29T17:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1C"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2F"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760489",
    "date": "2026-06-29T20:30Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1E"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760488",
    "date": "2026-06-30T01:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Guadalupe"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1F"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2C"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760490",
    "date": "2026-06-30T17:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "2E"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2I"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760492",
    "date": "2026-06-30T21:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1I"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760491",
    "date": "2026-07-01T01:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Mexico City"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1A"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760495",
    "date": "2026-07-01T16:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1L"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760493",
    "date": "2026-07-01T20:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1G"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760494",
    "date": "2026-07-02T00:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Santa Clara, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1D"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760497",
    "date": "2026-07-02T19:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1H"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2J"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760496",
    "date": "2026-07-02T23:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Toronto"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "2K"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2L"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760498",
    "date": "2026-07-03T03:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1B"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760499",
    "date": "2026-07-03T18:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "2D"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2G"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760500",
    "date": "2026-07-03T22:00Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1J"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "2H"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760501",
    "date": "2026-07-04T01:30Z",
    "season": {
      "slug": "round-of-32",
      "type": 13801
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "1K"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "3RD"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760502",
    "date": "2026-07-04T17:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Houston, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760503",
    "date": "2026-07-04T21:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Philadelphia, Pennsylvania"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760504",
    "date": "2026-07-05T20:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760505",
    "date": "2026-07-06T00:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Mexico City"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760506",
    "date": "2026-07-06T19:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760507",
    "date": "2026-07-07T00:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Seattle, Washington"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760509",
    "date": "2026-07-07T16:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760508",
    "date": "2026-07-07T20:00Z",
    "season": {
      "slug": "round-of-16",
      "type": 13800
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Vancouver"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD32"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD32"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760510",
    "date": "2026-07-09T20:00Z",
    "season": {
      "slug": "quarterfinals",
      "type": 13799
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Foxborough, Massachusetts"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD16 W1"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD16 W2"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760511",
    "date": "2026-07-10T19:00Z",
    "season": {
      "slug": "quarterfinals",
      "type": 13799
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Inglewood, California"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD16 W5"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD16 W6"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760512",
    "date": "2026-07-11T21:00Z",
    "season": {
      "slug": "quarterfinals",
      "type": 13799
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD16 W3"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD16 W4"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760513",
    "date": "2026-07-12T01:00Z",
    "season": {
      "slug": "quarterfinals",
      "type": 13799
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Kansas City, Missouri"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "RD16 W7"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "RD16 W8"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760514",
    "date": "2026-07-14T19:00Z",
    "season": {
      "slug": "semifinals",
      "type": 13798
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Arlington, Texas"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "QFW1"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "QFW2"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760515",
    "date": "2026-07-15T19:00Z",
    "season": {
      "slug": "semifinals",
      "type": 13798
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Atlanta, Georgia"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "QFW3"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "QW4"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760516",
    "date": "2026-07-18T21:00Z",
    "season": {
      "slug": "3rd-place-match",
      "type": 13797
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "Miami Gardens, Florida"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SF L1"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SF L2"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "760517",
    "date": "2026-07-19T19:00Z",
    "season": {
      "slug": "final",
      "type": 13803
    },
    "competitions": [
      {
        "venue": {
          "address": {
            "city": "East Rutherford, New Jersey"
          }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": {
              "abbreviation": "SFW1"
            }
          },
          {
            "homeAway": "away",
            "team": {
              "abbreviation": "SFW2"
            }
          }
        ]
      }
    ]
  }
] as unknown as EspnEvent[];

export const EXPECTED_GROUP_IDS: readonly string[] = [
  "2026-06-11-mexico-south-africa",
  "2026-06-11-south-korea-czech-republic",
  "2026-06-12-canada-bosnia-herzegovina",
  "2026-06-12-usa-paraguay",
  "2026-06-13-australia-turkey",
  "2026-06-13-brazil-morocco",
  "2026-06-13-haiti-scotland",
  "2026-06-13-qatar-switzerland",
  "2026-06-14-germany-cura-ao",
  "2026-06-14-ivory-coast-ecuador",
  "2026-06-14-netherlands-japan",
  "2026-06-14-sweden-tunisia",
  "2026-06-15-belgium-egypt",
  "2026-06-15-iran-new-zealand",
  "2026-06-15-saudi-arabia-uruguay",
  "2026-06-15-spain-cape-verde",
  "2026-06-16-argentina-algeria",
  "2026-06-16-austria-jordan",
  "2026-06-16-france-senegal",
  "2026-06-16-iraq-norway",
  "2026-06-17-england-croatia",
  "2026-06-17-ghana-panama",
  "2026-06-17-portugal-dr-congo",
  "2026-06-17-uzbekistan-colombia",
  "2026-06-18-canada-qatar",
  "2026-06-18-czech-republic-south-africa",
  "2026-06-18-mexico-south-korea",
  "2026-06-18-switzerland-bosnia-herzegovina",
  "2026-06-19-brazil-haiti",
  "2026-06-19-scotland-morocco",
  "2026-06-19-turkey-paraguay",
  "2026-06-19-usa-australia",
  "2026-06-20-ecuador-cura-ao",
  "2026-06-20-germany-ivory-coast",
  "2026-06-20-netherlands-sweden",
  "2026-06-20-tunisia-japan",
  "2026-06-21-belgium-iran",
  "2026-06-21-new-zealand-egypt",
  "2026-06-21-spain-saudi-arabia",
  "2026-06-21-uruguay-cape-verde",
  "2026-06-22-argentina-austria",
  "2026-06-22-france-iraq",
  "2026-06-22-jordan-algeria",
  "2026-06-22-norway-senegal",
  "2026-06-23-colombia-dr-congo",
  "2026-06-23-england-ghana",
  "2026-06-23-panama-croatia",
  "2026-06-23-portugal-uzbekistan",
  "2026-06-24-bosnia-herzegovina-qatar",
  "2026-06-24-czech-republic-mexico",
  "2026-06-24-morocco-haiti",
  "2026-06-24-scotland-brazil",
  "2026-06-24-south-africa-south-korea",
  "2026-06-24-switzerland-canada",
  "2026-06-25-cura-ao-ivory-coast",
  "2026-06-25-ecuador-germany",
  "2026-06-25-japan-sweden",
  "2026-06-25-paraguay-australia",
  "2026-06-25-tunisia-netherlands",
  "2026-06-25-turkey-usa",
  "2026-06-26-cape-verde-saudi-arabia",
  "2026-06-26-egypt-iran",
  "2026-06-26-new-zealand-belgium",
  "2026-06-26-norway-france",
  "2026-06-26-senegal-iraq",
  "2026-06-26-uruguay-spain",
  "2026-06-27-algeria-austria",
  "2026-06-27-colombia-portugal",
  "2026-06-27-croatia-ghana",
  "2026-06-27-dr-congo-uzbekistan",
  "2026-06-27-jordan-argentina",
  "2026-06-27-panama-england"
];

export const EXPECTED_KO_IDS: readonly string[] = [
  "m73",
  "m74",
  "m75",
  "m76",
  "m77",
  "m78",
  "m79",
  "m80",
  "m81",
  "m82",
  "m83",
  "m84",
  "m85",
  "m86",
  "m87",
  "m88",
  "m89",
  "m90",
  "m91",
  "m92",
  "m93",
  "m94",
  "m95",
  "m96",
  "m97",
  "m98",
  "m99",
  "m100",
  "m101",
  "m102",
  "m103",
  "m104"
];
