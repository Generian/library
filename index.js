// Define project scoring rules
let defaultFunctions = [
  {
    "field_value_factor": {
        "field": "num_views",
        "factor": 2, // All the factors won't have any impact since we're in multiply mode
        "modifier": "log2p",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_copies",
        "factor": 4,
        "modifier": "sqrt",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_likes",
        "factor": 16,
        "modifier": "none",
        "missing": 1
    }
  },
  {
    "field_value_factor": {
        "field": "num_simulations_runs",
        "factor": 1,
        "modifier": "log2p",
        "missing": 1
    }
  },
  {
    "exp": {
        "created": {
            "scale": "500d",
            "offset": "10d",
            "decay": 0.1
        }
    }
  }
]

// This is the default search query that is only used on page load
const defaultQuery = {
    "explain": true, // Just for debugging
    "size": 100, // This is just for debugging. Needs to be aligned with the offset we use for infinite scroll
    "query": {
        "function_score": {
            "query": {
              "bool": {
                "must": {
                  "match_all": {}
                },
                "must_not": {
                  "match": {"project_name": "Tutorial"}
                },
                "filter": []
              }
            },
            "functions": defaultFunctions,
            "score_mode": "multiply"
        }
    }
}

// Define function to indicate project age better. Not necessary, but let's update it as part of this task as well.
function dateDiff(created) {
  const today = new Date()

  //Get 1 day in milliseconds
  const one_day=1000*60*60*24

  // Calculate the difference in milliseconds and divide by length of one day
  const age_in_days = Math.round((today.getTime() - created.getTime())/one_day)

  const diff_months = today.getMonth() - created.getMonth()
  const diff_years = today.getFullYear() - created.getFullYear()

  let age_string = ""

  // This is to get rid of the ugly "Created 1025 days ago" age indication on most project cards
  if (age_in_days == 0) {
    age_string = "Created today"
  } else if (age_in_days == 1) {
    age_string = "Created yesterday"
  } else if (age_in_days < 14) {
    age_string = `Created ${age_in_days} days ago`
  } else if (age_in_days < 67) {
    age_string = `Created ${Math.round(age_in_days/7)} weeks ago`
  } else if (age_in_days >= 70) {
    if (diff_years == 0) {
      age_string = `Created ${diff_months} months ago`
    } else if (diff_years == 1) {
      age_string = "Created last year"
    } else {
      age_string = `Created ${diff_years} years ago`
    }
  } else {
    throw "Couldn't determine project age"
  }
  return age_string
}

// Function to get rid of the super long numbers. Let's format those better please
function numFormatter(num) {
  let formatted = ""
  if (num >= 1000000) {
    formatted = (num/1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    formatted = (num/1000).toFixed(1) + 'k'
  } else {
    formatted = num
  }
  return formatted
}

// Function to change the active state of the multi-select sort buttons
function updateActiveState(id) {
  $("button#num_views").removeClass("active")
  $("button#num_likes").removeClass("active")
  $("button#num_copies").removeClass("active")
  $("button#created").removeClass("active")
  $("button#modified").removeClass("active")
  $(`button#${id}`).addClass("active")
}

// Main function to populate the page with project cards in a specific order
function populateNew(newSearch = false, firstLoad = false) {
    // Determine filter and sorting modes
    let searchTerm = $("#searchByKeyword").val()
    let mode = $(".sortMode.active").attr('id')
    let timeframe = $(".timeFilter").val()
    let userSearch = false

    // In case of a new text search, reset all other filter and sorting options
    if (newSearch) {
      searchTerm = $("#searchByKeyword").val()
      mode = ""
      timeframe = "all"
      updateActiveState('none')
      $(".timeFilter").val("all")
    }

    // Elastic search query template that will be used for any page update after page load
    let data = {
        "explain": true, // Just for debugging
        "size": 100, // This is just for debugging. Needs to be aligned with the offset we use for infinite scroll
        "sort" : [
    	    "_score"
        ],
        "query": {
            "function_score": {
                "query": {
                  "bool": {
                    "must": {
                      "match_all": {}
                    },
                    "filter": []
                  }
                },
                "functions": [],
                "score_mode": "multiply"
            }
        }
    }

    // Additional feature that allows for search by username. Very fragile as of now. Can come later.
    if (searchTerm.slice(0,5) == "user:") {
      userSearch = true
      user = searchTerm.slice(5)
      searchTerm = "" // TODO: Handle remaining search term
      data.query.function_score.query.bool.filter.push({ "term":  { "owner_name": user }})
      defaultFunctions.pop() // Remove time decay when filtering by user
      data.query.function_score.functions = defaultFunctions
      data.query.function_score.score_mode = "sum"
    }

    // Handle text search
    if (searchTerm !== "") {
      data.query.function_score.query.bool.must = {
      	"match": {
      		"project_name": searchTerm
      	}
      }
      data.query.function_score.functions = defaultFunctions
    } else {
      data.query.function_score.query.bool.must = {
        "match_all": {}
      }
      data.query.function_score.query.bool.must_not = {
        "match": {"project_name": "Tutorial"}
      }
    }

    // Handle sorting mode
    if (mode !== "") {
      updateActiveState(mode) // Change active state of multi-select sort buttons
      data.sort = [
        { [mode] : {"order" : "desc"}},
        "_score"
      ]
    } else if (!userSearch && searchTerm == "") {
      firstLoad = true // Treat this case like the first page load (with default query)
    } else {
      data.sort = [
        "_score" // In cased of no mode, just sort by score
      ]
    }

    // Handle time frame filtering
    if (timeframe !== "all") {
      let d = new Date();
      d.setDate(d.getDate()-timeframe);
      data.query.function_score.query.bool.filter.push({"range": {"created": {"gte": d.toISOString()}}}) // So far it can only handle filtering by creation date. But that's fine for now
    }

    // Check if it's page load or not. In case of first page load serve the default query template
    data = firstLoad ? defaultQuery : data

    // Log query for debugging
    console.log("Search query: ",data)

    $.ajax({
        url: 'https://vpc-prod-project-info-zn5wnvz33xa6bt3puh2yfot5va.eu-west-1.es.amazonaws.com/read_project_info/_search',
        type: 'POST',
        data: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'},
        success: (resp) => {
            $('#projectsList').empty();
            if (resp.hits.total == 0) {
              $("#warning").removeClass("hideWarning")
            } else {
              $("#warning").addClass("hideWarning")
              resp.hits.hits.forEach((proj) => {
                  // Extract project data. Not sure if we already have everything we need to populate the entire card. Should be added to ES if missing I guess
                  const p = proj._source
                  // Single project card template
                  const $projectCard = `<div class="project-item">
                    <div class="project-thumb-item">
                      <div class="project-item-top"> <a class="project-image-wrapper" href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/"> <img class="img-responsive" src="https://www.simscale.com${p.thumbnail_url}"
                            alt="${p.thumbnail_url}"> </a>
                        <div class="project-permissions"> </div> <a href="https://www.simscale.com/workbench/?pid=${p.project_id_ext}" class="btn btn-sm btn-primary open-project-link"><i class="fa fa-share" title="Open in your workbench"></i></a>
                      </div>
                      <div class="project-item-bottom">
                        <div class="project-item-body">
                          <table>
                            <tbody>
                              <tr>
                                <td> <a href="https://www.simscale.com/projects/${p.owner_name}/${p.public_project_name}/">
                                    <p class="project-title">${p.project_name}</p>
                                  </a> </td>
                              </tr>
                              <tr>
                                <td><a href="https://www.simscale.com/users/${p.owner_name}/" class="project-author">${p.owner_name}</a></td>
                              </tr>
                              <tr>
                                <td colspan="2">
                                  <p class="project-info">${p.num_geometries} CAD model / ${p.num_meshes} mesh / ${p.num_simulations} simulation </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div class="project-item-footer">
                          <table>
                            <tbody>
                              <tr>
                                <td>
                                  <p class="project-date">${dateDiff(new Date(p.created))}</p>
                                </td>
                                <td class="project-links"> <i class="fas fa-eye" title="Number of views"></i><span>${numFormatter(p.num_views)}</span> <i class="fas fa-heart" title="Number of likes"></i><span>${numFormatter(p.num_likes)}</span> <i class="fas fa-code-branch"
                                    title="Number of copies"></i><span>${numFormatter(p.num_copies)}</span> </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>`
                  // Add project card
                  $('#projectsList').append($projectCard);
              })
            }
        }
    })
}

// Fill page on page load
populateNew(false,true)
